import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { agentDefinitions } from '../schema/agent-definition.js';
import type {
  AgentDefinition,
  AgentDefinitionSpec,
} from '../../contexts/agent-core/domain/agent-definition.js';

/**
 * agent_definitions 表数据访问层。
 *
 * spec 以 jsonb 存(resourceLimits/workspaceStrategy/boundTools/boundSkills/modelConfig 各列)。
 * repo 纯持久化,domain 校验由 service/调用方负责。
 */
export class AgentDefinitionRepository {
  constructor(private db: Database) {}

  async create(
    input: { id: string; tenantId: string; name: string; spec: AgentDefinitionSpec; description: string | null }
  ): Promise<AgentDefinition> {
    const [row] = await this.db
      .insert(agentDefinitions)
      .values({
        id: input.id,
        tenantId: input.tenantId,
        name: input.name,
        generation: 1,
        sandboxTemplate: input.spec.sandboxTemplate,
        resourceLimits: input.spec.resourceLimits as unknown as Record<string, unknown>,
        workspaceStrategy: input.spec.workspaceStrategy,
        boundTools: input.spec.boundTools,
        boundSkills: input.spec.boundSkills,
        modelConfig: input.spec.modelConfig as unknown as Record<string, unknown>,
        description: input.description,
      })
      .returning();
    return toDomain(row);
  }

  async getById(id: string): Promise<AgentDefinition | null> {
    const [row] = await this.db
      .select()
      .from(agentDefinitions)
      .where(eq(agentDefinitions.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async list(
    filter: { tenantId?: string; status?: string } = {},
    limit = 50,
    offset = 0
  ): Promise<AgentDefinition[]> {
    const conditions = [];
    if (filter.tenantId) conditions.push(eq(agentDefinitions.tenantId, filter.tenantId));
    if (filter.status) conditions.push(eq(agentDefinitions.status, filter.status));
    const rows = await this.db
      .select()
      .from(agentDefinitions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(agentDefinitions.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toDomain);
  }

  async updateSpec(
    id: string,
    spec: AgentDefinitionSpec
  ): Promise<AgentDefinition | null> {
    const [row] = await this.db
      .update(agentDefinitions)
      .set({
        sandboxTemplate: spec.sandboxTemplate,
        resourceLimits: spec.resourceLimits as unknown as Record<string, unknown>,
        workspaceStrategy: spec.workspaceStrategy,
        boundTools: spec.boundTools,
        boundSkills: spec.boundSkills,
        modelConfig: spec.modelConfig as unknown as Record<string, unknown>,
        // spec 变更 generation 递增(世代)
        generation: sql`generation + 1`,
        updatedAt: new Date(),
      })
      .where(eq(agentDefinitions.id, id))
      .returning();
    return row ? toDomain(row) : null;
  }

  async archive(id: string): Promise<void> {
    await this.db
      .update(agentDefinitions)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(agentDefinitions.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(agentDefinitions).where(eq(agentDefinitions.id, id));
  }
}

function toDomain(row: typeof agentDefinitions.$inferSelect): AgentDefinition {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    generation: row.generation,
    spec: {
      sandboxTemplate: row.sandboxTemplate,
      resourceLimits: row.resourceLimits as unknown as AgentDefinition['spec']['resourceLimits'],
      workspaceStrategy: row.workspaceStrategy,
      boundTools: row.boundTools,
      boundSkills: row.boundSkills,
      modelConfig: row.modelConfig as unknown as AgentDefinition['spec']['modelConfig'],
    },
    description: row.description,
    status: row.status as 'active' | 'archived',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
