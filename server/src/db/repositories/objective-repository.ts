import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { objectives } from '../schema/cockpit-objectives.js';
import {
  Objective,
  type ObjectiveLevel,
  type ObjectiveStatus,
  type PerformanceMetrics,
} from '../../contexts/cockpit/domain/objective/objective.js';

/**
 * objectives 表的 DB 实现（v2.1 EAOS 战略解码子系统）。
 *
 * 返回 Objective domain 实体（fromProps 重建，校验 level/status/confidence/metrics 不变式）。
 * 分页下推 DB（§7.2.1#2 limit/offset），filter 走 DB where（非内存过滤）。
 */
export interface ObjectiveListOptions {
  level?: ObjectiveLevel;
  parentId?: string;
  tenantId?: string;
  status?: ObjectiveStatus;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type ObjectiveRow = InferSelectModel<typeof objectives>;

export class ObjectiveRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Objective | null> {
    const rows = await this.db.select().from(objectives).where(eq(objectives.id, id)).limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 updatedAt 倒序）。 */
  async list(opts: ObjectiveListOptions = {}): Promise<Objective[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.level) conds.push(eq(objectives.level, opts.level));
    if (opts.parentId) conds.push(eq(objectives.parentId, opts.parentId));
    if (opts.tenantId) conds.push(eq(objectives.tenantId, opts.tenantId));
    if (opts.status) conds.push(eq(objectives.status, opts.status));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(objectives).where(where)
      : this.db.select().from(objectives);
    const rows = await query.limit(limit).offset(offset).orderBy(desc(objectives.updatedAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total，保持前端 paged 契约）。 */
  async listPaged(
    opts: ObjectiveListOptions = {}
  ): Promise<{ items: Objective[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({
        level: opts.level,
        parentId: opts.parentId,
        tenantId: opts.tenantId,
        status: opts.status,
      }),
    ]);
    return { items, total, limit, offset };
  }

  async count(
    opts: { level?: string; parentId?: string; tenantId?: string; status?: string } = {}
  ): Promise<number> {
    const conds = [];
    if (opts.level) conds.push(eq(objectives.level, opts.level));
    if (opts.parentId) conds.push(eq(objectives.parentId, opts.parentId));
    if (opts.tenantId) conds.push(eq(objectives.tenantId, opts.tenantId));
    if (opts.status) conds.push(eq(objectives.status, opts.status));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(objectives)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(objectives);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update（updatedAt 刷新），不存在则 insert。 */
  async save(objective: Objective): Promise<void> {
    const p = objective.toProps();
    const existing = await this.db
      .select({ id: objectives.id })
      .from(objectives)
      .where(eq(objectives.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(objectives)
        .set({
          level: p.level,
          parentId: p.parentId,
          tenantId: p.tenantId,
          title: p.title,
          description: p.description,
          confidence: p.confidence,
          status: p.status,
          metrics: p.metrics,
          updatedAt: new Date(),
        })
        .where(eq(objectives.id, p.id));
    } else {
      await this.db.insert(objectives).values({
        id: p.id,
        level: p.level,
        parentId: p.parentId,
        tenantId: p.tenantId,
        title: p.title,
        description: p.description,
        confidence: p.confidence,
        status: p.status,
        metrics: p.metrics,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(objectives).where(eq(objectives.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: ObjectiveRow): Objective {
    return Objective.fromProps({
      id: row.id,
      level: row.level as ObjectiveLevel,
      parentId: row.parentId ?? undefined,
      tenantId: row.tenantId ?? undefined,
      title: row.title ?? undefined,
      description: row.description ?? undefined,
      confidence: row.confidence ?? 0,
      status: row.status as ObjectiveStatus,
      metrics: this.parseMetrics(row.metrics),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /** jsonb unknown → PerformanceMetrics 形状（值不变式由 Objective.fromProps.normalizeMetrics clamp）。 */
  private parseMetrics(raw: unknown): PerformanceMetrics {
    if (raw && typeof raw === 'object') {
      const m = raw as Record<string, unknown>;
      return {
        completionRate: typeof m.completionRate === 'number' ? m.completionRate : 0,
        acceptanceRate: typeof m.acceptanceRate === 'number' ? m.acceptanceRate : 0,
        avgDurationMs: typeof m.avgDurationMs === 'number' ? m.avgDurationMs : 0,
        tokensCost: typeof m.tokensCost === 'number' ? m.tokensCost : 0,
      };
    }
    return { completionRate: 0, acceptanceRate: 0, avgDurationMs: 0, tokensCost: 0 };
  }
}
