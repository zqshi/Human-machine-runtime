import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { orchestrationAgents } from '../schema/cockpit-orchestration.js';
import {
  OrchestrationAgent,
  type OrchestrationAgentStatus,
} from '../../contexts/cockpit/domain/orchestration/orchestration-agent.js';

/**
 * orchestration_agents 表的 DB 实现（v2.1 EAOS 编排子系统）。
 *
 * 返回 OrchestrationAgent domain 实体（rehydrate 容错重建——EAV 迁移旧数据 status 可能脏，
 * 落白名单返回原值否则 fallback registered，不致 list 失败）。
 * 分页 + filter 下推 DB（§7.2.1#2，破 pagination.ts EAV 全量限制）。
 */
export interface OrchestrationAgentListOptions {
  agentId?: string;
  status?: OrchestrationAgentStatus;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type AgentRow = InferSelectModel<typeof orchestrationAgents>;

export class OrchestrationAgentRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<OrchestrationAgent | null> {
    const rows = await this.db
      .select()
      .from(orchestrationAgents)
      .where(eq(orchestrationAgents.id, id))
      .limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 registeredAt 倒序）。 */
  async list(opts: OrchestrationAgentListOptions = {}): Promise<OrchestrationAgent[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.agentId) conds.push(eq(orchestrationAgents.agentId, opts.agentId));
    if (opts.status) conds.push(eq(orchestrationAgents.status, opts.status));
    if (opts.tenantId) conds.push(eq(orchestrationAgents.tenantId, opts.tenantId));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(orchestrationAgents).where(where)
      : this.db.select().from(orchestrationAgents);
    const rows = await query
      .limit(limit)
      .offset(offset)
      .orderBy(desc(orchestrationAgents.registeredAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total）。 */
  async listPaged(
    opts: OrchestrationAgentListOptions = {}
  ): Promise<{ items: OrchestrationAgent[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({ agentId: opts.agentId, status: opts.status, tenantId: opts.tenantId }),
    ]);
    return { items, total, limit, offset };
  }

  async count(
    opts: { agentId?: string; status?: string; tenantId?: string } = {}
  ): Promise<number> {
    const conds = [];
    if (opts.agentId) conds.push(eq(orchestrationAgents.agentId, opts.agentId));
    if (opts.status) conds.push(eq(orchestrationAgents.status, opts.status));
    if (opts.tenantId) conds.push(eq(orchestrationAgents.tenantId, opts.tenantId));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(orchestrationAgents)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(orchestrationAgents);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update，不存在则 insert。agent 无状态机（route 无 PATCH），update 仅刷新 metadata/role。 */
  async save(agent: OrchestrationAgent): Promise<void> {
    const p = agent.toProps();
    const existing = await this.db
      .select({ id: orchestrationAgents.id })
      .from(orchestrationAgents)
      .where(eq(orchestrationAgents.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(orchestrationAgents)
        .set({
          agentId: p.agentId,
          role: p.role,
          status: p.status,
          metadata: p.metadata,
          tenantId: p.tenantId,
        })
        .where(eq(orchestrationAgents.id, p.id));
    } else {
      await this.db.insert(orchestrationAgents).values({
        id: p.id,
        agentId: p.agentId,
        role: p.role,
        status: p.status,
        metadata: p.metadata,
        tenantId: p.tenantId,
        registeredAt: p.registeredAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(orchestrationAgents).where(eq(orchestrationAgents.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: AgentRow): OrchestrationAgent {
    return OrchestrationAgent.rehydrate({
      id: row.id,
      agentId: row.agentId ?? undefined,
      role: row.role ?? undefined,
      status: row.status,
      metadata: row.metadata,
      tenantId: row.tenantId ?? undefined,
      registeredAt: row.registeredAt,
    });
  }
}
