import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { evaluationMetrics } from '../schema/cockpit-evaluation.js';
import {
  EvaluationMetric,
  type EvaluationDimension,
} from '../../contexts/cockpit/domain/evaluation/evaluation-metric.js';

/**
 * evaluation_metrics 表的 DB 实现（v2.1 EAOS 评估子系统）。
 *
 * 返回 EvaluationMetric domain 实体（rehydrate 容错重建——EAV 迁移旧数据 dimension 可能脏，
 * 落白名单返回原值否则 fallback human，不致 list 失败，同 escalation.rehydrate 范式）。
 * 分页 + filter 下推 DB（§7.2.1#2，破 pagination.ts EAV 全量限制——实体表 dimension/score 强类型列可 where）。
 */
export interface EvaluationMetricListOptions {
  dimension?: EvaluationDimension;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type MetricRow = InferSelectModel<typeof evaluationMetrics>;

export class EvaluationMetricRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<EvaluationMetric | null> {
    const rows = await this.db
      .select()
      .from(evaluationMetrics)
      .where(eq(evaluationMetrics.id, id))
      .limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 updatedAt 倒序）。 */
  async list(opts: EvaluationMetricListOptions = {}): Promise<EvaluationMetric[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.dimension) conds.push(eq(evaluationMetrics.dimension, opts.dimension));
    if (opts.tenantId) conds.push(eq(evaluationMetrics.tenantId, opts.tenantId));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(evaluationMetrics).where(where)
      : this.db.select().from(evaluationMetrics);
    const rows = await query.limit(limit).offset(offset).orderBy(desc(evaluationMetrics.updatedAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total）。 */
  async listPaged(
    opts: EvaluationMetricListOptions = {}
  ): Promise<{ items: EvaluationMetric[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({ dimension: opts.dimension, tenantId: opts.tenantId }),
    ]);
    return { items, total, limit, offset };
  }

  async count(opts: { dimension?: string; tenantId?: string } = {}): Promise<number> {
    const conds = [];
    if (opts.dimension) conds.push(eq(evaluationMetrics.dimension, opts.dimension));
    if (opts.tenantId) conds.push(eq(evaluationMetrics.tenantId, opts.tenantId));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(evaluationMetrics)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(evaluationMetrics);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update（updatedAt 刷新），不存在则 insert。 */
  async save(metric: EvaluationMetric): Promise<void> {
    const p = metric.toProps();
    const existing = await this.db
      .select({ id: evaluationMetrics.id })
      .from(evaluationMetrics)
      .where(eq(evaluationMetrics.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(evaluationMetrics)
        .set({
          dimension: p.dimension,
          score: p.score,
          metadata: p.metadata,
          tenantId: p.tenantId,
          updatedAt: new Date(),
        })
        .where(eq(evaluationMetrics.id, p.id));
    } else {
      await this.db.insert(evaluationMetrics).values({
        id: p.id,
        dimension: p.dimension,
        score: p.score,
        metadata: p.metadata,
        tenantId: p.tenantId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(evaluationMetrics).where(eq(evaluationMetrics.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: MetricRow): EvaluationMetric {
    return EvaluationMetric.rehydrate({
      id: row.id,
      dimension: row.dimension,
      score: row.score,
      metadata: row.metadata,
      tenantId: row.tenantId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
