import { eq, and, desc, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Database } from '../client.js';
import { orchestrationChains } from '../schema/cockpit-orchestration.js';
import {
  OrchestrationChain,
  type OrchestrationChainStatus,
  type OrchestrationStep,
} from '../../contexts/cockpit/domain/orchestration/orchestration-chain.js';

/**
 * orchestration_chains 表的 DB 实现（v2.1 EAOS 编排子系统）。
 *
 * 返回 OrchestrationChain domain 实体（fromProps 重建，校验 status 不变式）。
 * 分页 + filter 下推 DB（§7.2.1#2，破 pagination.ts EAV 全量限制——实体表强类型列可 where）。
 */
export interface OrchestrationChainListOptions {
  status?: OrchestrationChainStatus;
  agentId?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type ChainRow = InferSelectModel<typeof orchestrationChains>;

export class OrchestrationChainRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<OrchestrationChain | null> {
    const rows = await this.db
      .select()
      .from(orchestrationChains)
      .where(eq(orchestrationChains.id, id))
      .limit(1);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  /** 列表（filter + 分页下推 DB，按 updatedAt 倒序）。 */
  async list(opts: OrchestrationChainListOptions = {}): Promise<OrchestrationChain[]> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const conds = [];
    if (opts.status) conds.push(eq(orchestrationChains.status, opts.status));
    if (opts.agentId) conds.push(eq(orchestrationChains.agentId, opts.agentId));
    if (opts.tenantId) conds.push(eq(orchestrationChains.tenantId, opts.tenantId));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const query = where
      ? this.db.select().from(orchestrationChains).where(where)
      : this.db.select().from(orchestrationChains);
    const rows = await query
      .limit(limit)
      .offset(offset)
      .orderBy(desc(orchestrationChains.updatedAt));
    return rows.map((r) => this.mapRow(r));
  }

  /** 分页列表（§7.2.1#2：limit/offset 下推 DB + total）。 */
  async listPaged(
    opts: OrchestrationChainListOptions = {}
  ): Promise<{ items: OrchestrationChain[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, opts.offset ?? 0);
    const [items, total] = await Promise.all([
      this.list({ ...opts, limit, offset }),
      this.count({ status: opts.status, agentId: opts.agentId, tenantId: opts.tenantId }),
    ]);
    return { items, total, limit, offset };
  }

  async count(
    opts: { status?: string; agentId?: string; tenantId?: string } = {}
  ): Promise<number> {
    const conds = [];
    if (opts.status) conds.push(eq(orchestrationChains.status, opts.status));
    if (opts.agentId) conds.push(eq(orchestrationChains.agentId, opts.agentId));
    if (opts.tenantId) conds.push(eq(orchestrationChains.tenantId, opts.tenantId));
    const query = conds.length
      ? this.db
          .select({ value: count() })
          .from(orchestrationChains)
          .where(conds.length === 1 ? conds[0] : and(...conds))
      : this.db.select({ value: count() }).from(orchestrationChains);
    const rows = await query;
    return rows[0]?.value ?? 0;
  }

  /** upsert：存在则 update（updatedAt 刷新），不存在则 insert。 */
  async save(chain: OrchestrationChain): Promise<void> {
    const p = chain.toProps();
    const existing = await this.db
      .select({ id: orchestrationChains.id })
      .from(orchestrationChains)
      .where(eq(orchestrationChains.id, p.id))
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .update(orchestrationChains)
        .set({
          name: p.name,
          steps: p.steps,
          currentStep: p.currentStep,
          status: p.status,
          agentId: p.agentId,
          tenantId: p.tenantId,
          updatedAt: new Date(),
        })
        .where(eq(orchestrationChains.id, p.id));
    } else {
      await this.db.insert(orchestrationChains).values({
        id: p.id,
        name: p.name,
        steps: p.steps,
        currentStep: p.currentStep,
        status: p.status,
        agentId: p.agentId,
        tenantId: p.tenantId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(orchestrationChains).where(eq(orchestrationChains.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  private mapRow(row: ChainRow): OrchestrationChain {
    return OrchestrationChain.fromProps({
      id: row.id,
      name: row.name ?? undefined,
      steps: this.parseSteps(row.steps),
      currentStep: row.currentStep,
      status: row.status as OrchestrationChainStatus,
      agentId: row.agentId ?? undefined,
      tenantId: row.tenantId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private parseSteps(raw: unknown): OrchestrationStep[] {
    return Array.isArray(raw) ? (raw as OrchestrationStep[]) : [];
  }
}
