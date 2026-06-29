import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { decisions } from '../schema/cockpit-decisions.js';
import {
  Decision,
  type DecisionUrgency,
  type DecisionResponseStatus,
  type RecommendationOption,
} from '../../contexts/cockpit/domain/judgment/decision.js';

/**
 * decisions 表的 DB 实现（v2.1 EAOS 判断子系统）。
 *
 * 返回 Decision domain 实体（fromProps 重建，校验 urgency/responseStatus 不变式）。
 * 分页 + filter 下推 DB（§7.2.1#2，破 pagination.ts EAV 全量限制——实体表强类型列可 where）。
 */
export interface DecisionListOptions {
  responseStatus?: DecisionResponseStatus;
  agentId?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type DecisionRow = InferSelectModel<typeof decisions>;

export class DecisionRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Decision | null> {
    const rows = await this.db.select().from(decisions).where(eq(decisions.id, id)).limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 updatedAt 倒序）。 */
  async list(opts: DecisionListOptions = {}): Promise<Decision[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.responseStatus) conds.push(eq(decisions.responseStatus, opts.responseStatus));
    if (opts.agentId) conds.push(eq(decisions.agentId, opts.agentId));
    if (opts.tenantId) conds.push(eq(decisions.tenantId, opts.tenantId));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(decisions).where(where)
      : this.db.select().from(decisions);
    const rows = await query.limit(limit).offset(offset).orderBy(desc(decisions.updatedAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total）。 */
  async listPaged(
    opts: DecisionListOptions = {}
  ): Promise<{ items: Decision[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({
        responseStatus: opts.responseStatus,
        agentId: opts.agentId,
        tenantId: opts.tenantId,
      }),
    ]);
    return { items, total, limit, offset };
  }

  async count(
    opts: { responseStatus?: string; agentId?: string; tenantId?: string } = {}
  ): Promise<number> {
    const conds = [];
    if (opts.responseStatus) conds.push(eq(decisions.responseStatus, opts.responseStatus));
    if (opts.agentId) conds.push(eq(decisions.agentId, opts.agentId));
    if (opts.tenantId) conds.push(eq(decisions.tenantId, opts.tenantId));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(decisions)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(decisions);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update（updatedAt 刷新），不存在则 insert。 */
  async save(decision: Decision): Promise<void> {
    const p = decision.toProps();
    const existing = await this.db
      .select({ id: decisions.id })
      .from(decisions)
      .where(eq(decisions.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(decisions)
        .set({
          agentId: p.agentId,
          title: p.title,
          context: p.context,
          recommendation: p.recommendation,
          alternatives: p.alternatives,
          urgency: p.urgency,
          deadline: p.deadline,
          responseStatus: p.responseStatus,
          userResponse: p.userResponse,
          responseAt: p.responseAt,
          impactScope: p.impactScope,
          downstreamTaskIds: p.downstreamTaskIds,
          downstreamGoalIds: p.downstreamGoalIds,
          tenantId: p.tenantId,
          updatedAt: new Date(),
        })
        .where(eq(decisions.id, p.id));
    } else {
      await this.db.insert(decisions).values({
        id: p.id,
        agentId: p.agentId,
        title: p.title,
        context: p.context,
        recommendation: p.recommendation,
        alternatives: p.alternatives,
        urgency: p.urgency,
        deadline: p.deadline,
        responseStatus: p.responseStatus,
        userResponse: p.userResponse,
        responseAt: p.responseAt,
        impactScope: p.impactScope,
        downstreamTaskIds: p.downstreamTaskIds,
        downstreamGoalIds: p.downstreamGoalIds,
        tenantId: p.tenantId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(decisions).where(eq(decisions.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: DecisionRow): Decision {
    return Decision.fromProps({
      id: row.id,
      agentId: row.agentId ?? undefined,
      title: row.title ?? undefined,
      context: row.context ?? undefined,
      recommendation: this.parseRecommendation(row.recommendation),
      alternatives: this.parseOptions(row.alternatives),
      urgency: row.urgency as DecisionUrgency,
      deadline: row.deadline ?? 0,
      responseStatus: row.responseStatus as DecisionResponseStatus,
      userResponse: row.userResponse ?? undefined,
      responseAt: row.responseAt ?? undefined,
      impactScope: row.impactScope ?? 0,
      downstreamTaskIds: this.parseStringArray(row.downstreamTaskIds),
      downstreamGoalIds: this.parseStringArray(row.downstreamGoalIds),
      tenantId: row.tenantId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /** jsonb unknown → RecommendationOption 形状（值不变式由 Decision.fromProps.normalizeRecommendation 规整）。 */
  private parseRecommendation(raw: unknown): RecommendationOption {
    if (raw && typeof raw === 'object') {
      return raw as RecommendationOption;
    }
    return {
      id: '',
      label: '',
      description: '',
      reasoning: '',
      estimatedImpact: '',
      riskLevel: 'medium',
    };
  }

  private parseOptions(raw: unknown): RecommendationOption[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (x): x is Record<string, unknown> => x != null && typeof x === 'object'
    ) as unknown as RecommendationOption[];
  }

  private parseStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string');
  }
}
