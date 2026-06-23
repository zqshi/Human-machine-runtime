import type {
  BillingAccount,
  BillingEvent,
  ListEventsFilter,
  RecordEventInput,
} from './domain/billing-event.js';
import { logger } from '../../app/logger.js';

/**
 * BillingService — 计费骨架的服务层。
 *
 * 职责:
 *   - recordEvent:记账事件 + 累加账户余额。失败仅 log warn 不抛(避免阻断业务主链路)。
 *   - getAccount:查询租户当前余额(未写入时返回 null,由调用方决定默认值)。
 *   - listEvents:按条件查询事件流。
 *
 * 不实现(本期骨架):
 *   - 账单生成(weekly/monthly invoice)
 *   - 充值/退款
 *   - 对账任务
 *
 * 通过构造注入 IBillingRepository 接口(便于测试 mock DB)。
 */
export interface IBillingRepository {
  recordEvent(input: RecordEventInput): Promise<BillingEvent>;
  listEvents(tenantId: string, filter?: ListEventsFilter): Promise<BillingEvent[]>;
  getAccount(tenantId: string): Promise<{
    tenantId: string;
    balance: number;
    currency: string;
    updatedAt: string;
  } | null>;
  upsertAccountDelta(tenantId: string, delta: number, currency?: string): Promise<void>;
}

export class BillingService {
  constructor(private readonly repo: IBillingRepository) {}

  /**
   * 记录计费事件 + 累加账户余额。
   *
   * 容错策略:事件落库失败 → 抛错让调用方感知;账户 upsert 失败 → 仅 log warn
   * (事件已落库,对账任务可补偿账户余额)。整个方法不抛错会"静默丢失"记账,
   * 对 billing 是不可接受的;抛错让调用方决定 fire-and-forget 还是 retry。
   */
  async recordEvent(input: RecordEventInput): Promise<BillingEvent> {
    const event = await this.repo.recordEvent(input);
    try {
      await this.repo.upsertAccountDelta(input.tenantId, input.amount);
    } catch (err) {
      logger.warn(
        { tenantId: input.tenantId, eventId: event.id, err: String(err) },
        'billing account upsert failed; event recorded but balance not updated'
      );
    }
    return event;
  }

  async getAccount(tenantId: string): Promise<BillingAccount | null> {
    const account = await this.repo.getAccount(tenantId);
    return account;
  }

  async listEvents(tenantId: string, filter?: ListEventsFilter): Promise<BillingEvent[]> {
    return this.repo.listEvents(tenantId, filter);
  }
}
