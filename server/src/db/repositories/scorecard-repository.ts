import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { scorecards } from '../schema/cockpit-evaluation.js';
import { Scorecard } from '../../contexts/cockpit/domain/evaluation/scorecard.js';

/**
 * scorecards 表的 DB 实现（v2.1 EAOS 评估子系统）。
 *
 * 返回 Scorecard domain 实体（rehydrate 容错重建——EAV 迁移旧数据 scores/overallScore 可能脏，
 * 规整不抛错，同 escalation.rehydrate 范式）。
 * 分页 + filter 下推 DB（§7.2.1#2，破 pagination.ts EAV 全量限制）。
 * scorecard route 无 PATCH（创建后不变），save upsert 保留 update 分支为未来 PATCH 预留。
 */
export interface ScorecardListOptions {
  tenantId?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type ScorecardRow = InferSelectModel<typeof scorecards>;

export class ScorecardRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Scorecard | null> {
    const rows = await this.db.select().from(scorecards).where(eq(scorecards.id, id)).limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 createdAt 倒序）。 */
  async list(opts: ScorecardListOptions = {}): Promise<Scorecard[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.tenantId) conds.push(eq(scorecards.tenantId, opts.tenantId));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(scorecards).where(where)
      : this.db.select().from(scorecards);
    const rows = await query.limit(limit).offset(offset).orderBy(desc(scorecards.createdAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total）。 */
  async listPaged(
    opts: ScorecardListOptions = {}
  ): Promise<{ items: Scorecard[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({ tenantId: opts.tenantId }),
    ]);
    return { items, total, limit, offset };
  }

  async count(opts: { tenantId?: string } = {}): Promise<number> {
    const conds = [];
    if (opts.tenantId) conds.push(eq(scorecards.tenantId, opts.tenantId));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(scorecards)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(scorecards);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update（updatedAt 刷新），不存在则 insert。 */
  async save(scorecard: Scorecard): Promise<void> {
    const p = scorecard.toProps();
    const existing = await this.db
      .select({ id: scorecards.id })
      .from(scorecards)
      .where(eq(scorecards.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(scorecards)
        .set({
          scores: p.scores,
          overallScore: p.overallScore,
          metadata: p.metadata,
          tenantId: p.tenantId,
          updatedAt: new Date(),
        })
        .where(eq(scorecards.id, p.id));
    } else {
      await this.db.insert(scorecards).values({
        id: p.id,
        scores: p.scores,
        overallScore: p.overallScore,
        metadata: p.metadata,
        tenantId: p.tenantId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(scorecards).where(eq(scorecards.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: ScorecardRow): Scorecard {
    return Scorecard.rehydrate({
      id: row.id,
      scores: row.scores,
      overallScore: row.overallScore,
      metadata: row.metadata,
      tenantId: row.tenantId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
