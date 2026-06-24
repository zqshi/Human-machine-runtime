import { eq, and, desc, sql, count, inArray } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  toolSources,
  toolDefinitions,
  toolInstances,
  toolCallLogs,
} from '../schema/tool-registry.js';

/* ──── Types ──── */

export type ToolSourceRow = typeof toolSources.$inferSelect;
export type ToolSourceInsert = typeof toolSources.$inferInsert;
export type ToolDefinitionRow = typeof toolDefinitions.$inferSelect;
export type ToolDefinitionInsert = typeof toolDefinitions.$inferInsert;
export type ToolInstanceRow = typeof toolInstances.$inferSelect;
export type ToolInstanceInsert = typeof toolInstances.$inferInsert;
export type ToolCallLogRow = typeof toolCallLogs.$inferSelect;
export type ToolCallLogInsert = typeof toolCallLogs.$inferInsert;

/* ──── Tool Source Repository ──── */

export class ToolSourceRepository {
  constructor(private db: Database) {}

  async findAll(tenantId: string): Promise<ToolSourceRow[]> {
    return this.db
      .select()
      .from(toolSources)
      .where(eq(toolSources.tenantId, tenantId))
      .orderBy(desc(toolSources.createdAt));
  }

  async findById(id: string): Promise<ToolSourceRow | null> {
    const [row] = await this.db.select().from(toolSources).where(eq(toolSources.id, id));
    return row ?? null;
  }

  async create(data: ToolSourceInsert): Promise<ToolSourceRow> {
    const [row] = await this.db.insert(toolSources).values(data).returning();
    return row;
  }

  async update(id: string, data: Partial<ToolSourceInsert>): Promise<ToolSourceRow | null> {
    const [row] = await this.db
      .update(toolSources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(toolSources.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(toolSources).where(eq(toolSources.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async updateToolCount(id: string, toolCount: number): Promise<void> {
    await this.db
      .update(toolSources)
      .set({ toolCount, updatedAt: new Date() })
      .where(eq(toolSources.id, id));
  }

  async updateSyncStatus(
    id: string,
    status: { lastSyncedAt?: Date; lastSyncError?: string | null; status?: string }
  ): Promise<void> {
    await this.db
      .update(toolSources)
      .set({ ...status, updatedAt: new Date() })
      .where(eq(toolSources.id, id));
  }

  /** 更新健康检查结果（P4）。 */
  async updateHealth(
    id: string,
    data: {
      healthStatus: string;
      lastHealthCheckAt: Date;
      lastHealthError: string | null;
      consecutiveFailures: number;
    }
  ): Promise<void> {
    await this.db
      .update(toolSources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(toolSources.id, id));
  }

  /** 全量查询（不限租户，供 scheduler 全局健康检查）。 */
  async findAllAll(): Promise<ToolSourceRow[]> {
    return this.db.select().from(toolSources);
  }
}

/* ──── Tool Definition Repository ──── */

export class ToolDefinitionRepository {
  constructor(private db: Database) {}

  async findByTenant(tenantId: string): Promise<ToolDefinitionRow[]> {
    return this.db
      .select()
      .from(toolDefinitions)
      .where(eq(toolDefinitions.tenantId, tenantId))
      .orderBy(desc(toolDefinitions.createdAt));
  }

  async findBySource(sourceId: string): Promise<ToolDefinitionRow[]> {
    return this.db
      .select()
      .from(toolDefinitions)
      .where(eq(toolDefinitions.sourceId, sourceId))
      .orderBy(toolDefinitions.name);
  }

  async findById(id: string): Promise<ToolDefinitionRow | null> {
    const [row] = await this.db.select().from(toolDefinitions).where(eq(toolDefinitions.id, id));
    return row ?? null;
  }

  /** v1.4:批量按 id 查(组装层 boundTools→allowedTools 用)。空数组返回空,不报错。repo 纯持久化不过滤,enabled/tenantId 校验留 domain 层。 */
  async findByIds(ids: string[]): Promise<ToolDefinitionRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(toolDefinitions)
      .where(inArray(toolDefinitions.id, ids));
  }

  async findEnabledByTenant(tenantId: string): Promise<ToolDefinitionRow[]> {
    return this.db
      .select()
      .from(toolDefinitions)
      .where(and(eq(toolDefinitions.tenantId, tenantId), eq(toolDefinitions.enabled, true)));
  }

  async create(data: ToolDefinitionInsert): Promise<ToolDefinitionRow> {
    const [row] = await this.db.insert(toolDefinitions).values(data).returning();
    return row;
  }

  async createMany(data: ToolDefinitionInsert[]): Promise<number> {
    if (data.length === 0) return 0;
    const result = await this.db.insert(toolDefinitions).values(data);
    return (result as unknown as { rowCount: number }).rowCount;
  }

  async update(id: string, data: Partial<ToolDefinitionInsert>): Promise<ToolDefinitionRow | null> {
    const [row] = await this.db
      .update(toolDefinitions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(toolDefinitions.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(toolDefinitions).where(eq(toolDefinitions.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async deleteBySource(sourceId: string): Promise<number> {
    const result = await this.db
      .delete(toolDefinitions)
      .where(eq(toolDefinitions.sourceId, sourceId));
    return (result as unknown as { rowCount: number }).rowCount;
  }

  async incrementCallCount(id: string): Promise<void> {
    await this.db
      .update(toolDefinitions)
      .set({
        callCount: sql`${toolDefinitions.callCount} + 1`,
        lastCalledAt: new Date(),
      })
      .where(eq(toolDefinitions.id, id));
  }
}

/* ──── Tool Instance Repository ──── */

export class ToolInstanceRepository {
  constructor(private db: Database) {}

  async findByTenant(tenantId: string): Promise<ToolInstanceRow[]> {
    return this.db
      .select()
      .from(toolInstances)
      .where(eq(toolInstances.tenantId, tenantId))
      .orderBy(desc(toolInstances.createdAt));
  }

  async findByInstance(instanceId: string): Promise<ToolInstanceRow[]> {
    return this.db.select().from(toolInstances).where(eq(toolInstances.instanceId, instanceId));
  }

  async findById(id: string): Promise<ToolInstanceRow | null> {
    const [row] = await this.db.select().from(toolInstances).where(eq(toolInstances.id, id));
    return row ?? null;
  }

  async create(data: ToolInstanceInsert): Promise<ToolInstanceRow> {
    const [row] = await this.db.insert(toolInstances).values(data).returning();
    return row;
  }

  async update(id: string, data: Partial<ToolInstanceInsert>): Promise<ToolInstanceRow | null> {
    const [row] = await this.db
      .update(toolInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(toolInstances.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(toolInstances).where(eq(toolInstances.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }
}

/* ──── Tool Call Log Repository ──── */

export class ToolCallLogRepository {
  constructor(private db: Database) {}

  async create(data: ToolCallLogInsert): Promise<void> {
    await this.db.insert(toolCallLogs).values(data);
  }

  async findByTenant(
    tenantId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<ToolCallLogRow[]> {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;
    return this.db
      .select()
      .from(toolCallLogs)
      .where(eq(toolCallLogs.tenantId, tenantId))
      .orderBy(desc(toolCallLogs.calledAt))
      .limit(limit)
      .offset(offset);
  }

  async countByTenant(tenantId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(toolCallLogs)
      .where(eq(toolCallLogs.tenantId, tenantId));
    return row?.value ?? 0;
  }

  async getStats(tenantId: string): Promise<{
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    avgDurationMs: number;
  }> {
    const [row] = await this.db
      .select({
        totalCalls: count(),
        successCalls: sql<number>`count(*) filter (where status = 'success')`,
        failedCalls: sql<number>`count(*) filter (where status != 'success')`,
        avgDurationMs: sql<number>`coalesce(avg(duration_ms), 0)`,
      })
      .from(toolCallLogs)
      .where(eq(toolCallLogs.tenantId, tenantId));
    return {
      totalCalls: row?.totalCalls ?? 0,
      successCalls: Number(row?.successCalls ?? 0),
      failedCalls: Number(row?.failedCalls ?? 0),
      avgDurationMs: Math.round(Number(row?.avgDurationMs ?? 0)),
    };
  }
}
