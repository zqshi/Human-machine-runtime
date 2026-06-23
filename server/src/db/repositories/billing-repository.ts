import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { billingEvents, billingAccounts } from '../schema/billing.js';
import type {
  BillingEvent,
  BillingEventType,
  ListEventsFilter,
  RecordEventInput,
} from '../../contexts/billing/domain/billing-event.js';

/**
 * billing 数据访问层。
 *
 * - recordEvent:INSERT 事件 + UPSERT 账户余额(per-tenant 单行)。
 *   余额方向:消费累加为正(表示已用量,负数=预付结余)。
 * - 事务一致性:两步操作在应用层串行,不带事务。理由:billing 容错优先于一致性,
 *   若账户 upsert 失败,事件本身已落库,后台对账任务可补偿。集成测试覆盖此场景。
 * - 原子增量:incrementAccountBalance 用 SQL 表达式 balance = balance + delta,
 *   避免读改写竞争;upsert 用 INSERT ... ON CONFLICT (tenant_id) DO UPDATE。
 */
export class BillingRepository {
  constructor(private db: Database) {}

  async recordEvent(input: RecordEventInput): Promise<BillingEvent> {
    const [row] = await this.db
      .insert(billingEvents)
      .values({
        tenantId: input.tenantId,
        type: input.type,
        amount: input.amount.toFixed(4),
        metadata: input.metadata ?? {},
      })
      .returning();
    return toEventDomain(row);
  }

  async listEvents(tenantId: string, filter?: ListEventsFilter): Promise<BillingEvent[]> {
    const conditions = [eq(billingEvents.tenantId, tenantId)];
    if (filter?.type) conditions.push(eq(billingEvents.type, filter.type));
    if (filter?.since) conditions.push(gte(billingEvents.createdAt, new Date(filter.since)));
    if (filter?.until) conditions.push(lt(billingEvents.createdAt, new Date(filter.until)));

    const rows = await this.db
      .select()
      .from(billingEvents)
      .where(and(...conditions))
      .orderBy(desc(billingEvents.createdAt))
      .limit(filter?.limit ?? 100)
      .offset(filter?.offset ?? 0);
    return rows.map(toEventDomain);
  }

  async getAccount(tenantId: string): Promise<{
    tenantId: string;
    balance: number;
    currency: string;
    updatedAt: string;
  } | null> {
    const [row] = await this.db
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.tenantId, tenantId))
      .limit(1);
    return row
      ? {
          tenantId: row.tenantId,
          balance: Number(row.balance),
          currency: row.currency,
          updatedAt: row.updatedAt.toISOString(),
        }
      : null;
  }

  /**
   * UPSERT 账户余额:首次 INSERT,已存在则 balance = balance + delta(原子 SQL)。
   * currency 只在首次 INSERT 生效;已存在账户的 currency 不会被覆盖。
   */
  async upsertAccountDelta(tenantId: string, delta: number, currency = 'USD'): Promise<void> {
    await this.db
      .insert(billingAccounts)
      .values({
        tenantId,
        balance: delta.toFixed(4),
        currency,
      })
      .onConflictDoUpdate({
        target: billingAccounts.tenantId,
        set: {
          balance: sql`${billingAccounts.balance} + ${delta.toFixed(4)}`,
          updatedAt: new Date(),
        },
      });
  }
}

function toEventDomain(row: typeof billingEvents.$inferSelect): BillingEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type as BillingEventType,
    amount: Number(row.amount),
    currency: row.currency,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}
