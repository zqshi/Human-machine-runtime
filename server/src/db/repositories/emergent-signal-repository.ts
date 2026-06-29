import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { emergentSignals } from '../schema/cockpit-signals.js';
import {
  EmergentSignal,
  type SignalSeverity,
  type SignalStatus,
} from '../../contexts/cockpit/domain/sensing/emergent-signal.js';

/**
 * emergent_signals 表的 DB 实现（v2.1 EAOS 感知子系统）。
 *
 * 返回 EmergentSignal domain 实体（fromProps 重建，校验枚举不变式）。
 * 分页下推 DB（§7.2.1#2 limit/offset），filter 走 DB where（非内存过滤）。
 */
export interface SignalListOptions {
  severity?: SignalSeverity;
  status?: SignalStatus;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type EmergentSignalRow = InferSelectModel<typeof emergentSignals>;

export class EmergentSignalRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<EmergentSignal | null> {
    const rows = await this.db
      .select()
      .from(emergentSignals)
      .where(eq(emergentSignals.id, id))
      .limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 detectedAt 倒序）。 */
  async list(opts: SignalListOptions = {}): Promise<EmergentSignal[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.severity) conds.push(eq(emergentSignals.severity, opts.severity));
    if (opts.status) conds.push(eq(emergentSignals.status, opts.status));
    if (opts.tenantId) conds.push(eq(emergentSignals.tenantId, opts.tenantId));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(emergentSignals).where(where)
      : this.db.select().from(emergentSignals);
    const rows = await query.limit(limit).offset(offset).orderBy(desc(emergentSignals.detectedAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total，保持前端 paged 契约）。 */
  async listPaged(
    opts: SignalListOptions = {}
  ): Promise<{ items: EmergentSignal[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({ severity: opts.severity, status: opts.status, tenantId: opts.tenantId }),
    ]);
    return { items, total, limit, offset };
  }

  async count(
    opts: { severity?: string; status?: string; tenantId?: string } = {}
  ): Promise<number> {
    const conds = [];
    if (opts.severity) conds.push(eq(emergentSignals.severity, opts.severity));
    if (opts.status) conds.push(eq(emergentSignals.status, opts.status));
    if (opts.tenantId) conds.push(eq(emergentSignals.tenantId, opts.tenantId));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(emergentSignals)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(emergentSignals);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update（updatedAt 刷新），不存在则 insert。 */
  async save(signal: EmergentSignal): Promise<void> {
    const p = signal.toProps();
    const existing = await this.db
      .select({ id: emergentSignals.id })
      .from(emergentSignals)
      .where(eq(emergentSignals.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(emergentSignals)
        .set({
          patternId: p.patternId,
          correlatedSignalIds: p.correlatedSignalIds,
          pattern: p.pattern,
          severity: p.severity,
          suggestedAction: p.suggestedAction,
          status: p.status,
          detectedAt: p.detectedAt,
          resolvedAt: p.resolvedAt,
          tenantId: p.tenantId,
          updatedAt: new Date(),
        })
        .where(eq(emergentSignals.id, p.id));
    } else {
      await this.db.insert(emergentSignals).values({
        id: p.id,
        patternId: p.patternId,
        correlatedSignalIds: p.correlatedSignalIds,
        pattern: p.pattern,
        severity: p.severity,
        suggestedAction: p.suggestedAction,
        status: p.status,
        detectedAt: p.detectedAt,
        resolvedAt: p.resolvedAt,
        tenantId: p.tenantId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(emergentSignals).where(eq(emergentSignals.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: EmergentSignalRow): EmergentSignal {
    return EmergentSignal.fromProps({
      id: row.id,
      patternId: row.patternId ?? undefined,
      correlatedSignalIds: Array.isArray(row.correlatedSignalIds)
        ? (row.correlatedSignalIds as string[])
        : [],
      pattern: row.pattern ?? '',
      severity: row.severity as SignalSeverity,
      suggestedAction: row.suggestedAction ?? undefined,
      status: row.status as SignalStatus,
      detectedAt: row.detectedAt ?? 0,
      resolvedAt: row.resolvedAt ?? undefined,
      tenantId: row.tenantId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
