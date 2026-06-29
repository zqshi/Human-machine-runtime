import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { escalations } from '../schema/cockpit-orchestration.js';
import {
  Escalation,
  type EscalationStatus,
} from '../../contexts/cockpit/domain/orchestration/escalation.js';

/**
 * escalations 表的 DB 实现（v2.1 EAOS 编排子系统）。
 *
 * 返回 Escalation domain 实体（rehydrate 容错重建——EAV 迁移旧数据 status 可能脏，
 * 落白名单返回原值否则 fallback open，不致 list 失败，同 judgment-record.rehydrate 范式）。
 * 分页 + filter 下推 DB（§7.2.1#2，破 pagination.ts EAV 全量限制）。
 */
export interface EscalationListOptions {
  status?: EscalationStatus;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type EscalationRow = InferSelectModel<typeof escalations>;

export class EscalationRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Escalation | null> {
    const rows = await this.db.select().from(escalations).where(eq(escalations.id, id)).limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 updatedAt 倒序）。 */
  async list(opts: EscalationListOptions = {}): Promise<Escalation[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.status) conds.push(eq(escalations.status, opts.status));
    if (opts.tenantId) conds.push(eq(escalations.tenantId, opts.tenantId));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(escalations).where(where)
      : this.db.select().from(escalations);
    const rows = await query.limit(limit).offset(offset).orderBy(desc(escalations.updatedAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total）。 */
  async listPaged(
    opts: EscalationListOptions = {}
  ): Promise<{ items: Escalation[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({ status: opts.status, tenantId: opts.tenantId }),
    ]);
    return { items, total, limit, offset };
  }

  async count(opts: { status?: string; tenantId?: string } = {}): Promise<number> {
    const conds = [];
    if (opts.status) conds.push(eq(escalations.status, opts.status));
    if (opts.tenantId) conds.push(eq(escalations.tenantId, opts.tenantId));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(escalations)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(escalations);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update（updatedAt 刷新），不存在则 insert。 */
  async save(escalation: Escalation): Promise<void> {
    const p = escalation.toProps();
    const existing = await this.db
      .select({ id: escalations.id })
      .from(escalations)
      .where(eq(escalations.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(escalations)
        .set({
          status: p.status,
          severity: p.severity,
          triggerReason: p.triggerReason,
          relatedTaskId: p.relatedTaskId,
          metadata: p.metadata,
          tenantId: p.tenantId,
          updatedAt: new Date(),
        })
        .where(eq(escalations.id, p.id));
    } else {
      await this.db.insert(escalations).values({
        id: p.id,
        status: p.status,
        severity: p.severity,
        triggerReason: p.triggerReason,
        relatedTaskId: p.relatedTaskId,
        metadata: p.metadata,
        tenantId: p.tenantId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(escalations).where(eq(escalations.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: EscalationRow): Escalation {
    return Escalation.rehydrate({
      id: row.id,
      status: row.status,
      severity: row.severity ?? undefined,
      triggerReason: row.triggerReason ?? undefined,
      relatedTaskId: row.relatedTaskId ?? undefined,
      metadata: row.metadata,
      tenantId: row.tenantId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
