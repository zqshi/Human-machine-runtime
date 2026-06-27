import type { AgentDefinitionRepository } from '../../../db/repositories/agent-definition-repository.js';
import type { IAuditPort } from '../domain/audit-port.js';
import {
  createAgentDefinition,
  validateAgentDefinitionSpec,
  type AgentDefinition,
  type AgentDefinitionSpec,
} from '../domain/agent-definition.js';
import { AppError } from '../../../shared/utils.js';

/**
 * AgentDefinitionService — Agent 定义 CRD 的用例编排(application 层)。
 *
 * 职责:校验 spec → 调 domain 构造 → 持久化(repo) → 审计留痕。
 * 不含渲染/路由逻辑(§1 分层)。repo 纯持久化,domain 校验在此触发。
 *
 * generation 世代:update 走 repo.updateSpec(内部 generation+1),与 instance.specGeneration 对齐。
 * 审计:每个写操作留痕(actor 默认 system,路由层可传入鉴权用户)。
 */
export interface CreateAgentDefinitionInput {
  tenantId: string;
  name: string;
  spec: AgentDefinitionSpec;
  description?: string | null;
}

export interface UpdateAgentDefinitionInput {
  spec: AgentDefinitionSpec;
}

export interface ListAgentDefinitionsQuery {
  tenantId?: string;
  status?: string;
  skip?: number;
  limit?: number;
}

export class AgentDefinitionService {
  constructor(
    private readonly repo: AgentDefinitionRepository,
    private readonly audit?: IAuditPort
  ) {}

  async create(input: CreateAgentDefinitionInput, actor = 'system'): Promise<AgentDefinition> {
    const errors = validateAgentDefinitionSpec(input.spec);
    if (errors.length > 0) {
      throw new AppError(
        `agent definition spec invalid: ${errors.map((e) => e.field).join(', ')}`,
        400,
        'AGENT_DEF_SPEC_INVALID'
      );
    }
    const def = createAgentDefinition({
      tenantId: input.tenantId,
      name: input.name,
      spec: input.spec,
      description: input.description ?? null,
    });
    const saved = await this.repo.create({
      id: def.id,
      tenantId: def.tenantId,
      name: def.name,
      spec: def.spec,
      description: def.description,
    });
    this.audit?.log(
      'agent_definition.created',
      { id: saved.id, tenantId: saved.tenantId, name: saved.name },
      { actor: { username: actor, role: 'platform_admin' } }
    );
    return saved;
  }

  async get(id: string): Promise<AgentDefinition> {
    const def = await this.repo.getById(id);
    if (!def) throw new AppError('agent definition not found', 404, 'AGENT_DEF_NOT_FOUND');
    return def;
  }

  async update(
    id: string,
    input: UpdateAgentDefinitionInput,
    actor = 'system'
  ): Promise<AgentDefinition> {
    const errors = validateAgentDefinitionSpec(input.spec);
    if (errors.length > 0) {
      throw new AppError(
        `agent definition spec invalid: ${errors.map((e) => e.field).join(', ')}`,
        400,
        'AGENT_DEF_SPEC_INVALID'
      );
    }
    const existing = await this.repo.getById(id);
    if (!existing) throw new AppError('agent definition not found', 404, 'AGENT_DEF_NOT_FOUND');
    const updated = await this.repo.updateSpec(id, input.spec);
    this.audit?.log(
      'agent_definition.updated',
      { id, generation: updated?.generation, tenantId: existing.tenantId },
      { actor: { username: actor, role: 'platform_admin' } }
    );
    return updated!;
  }

  async list(
    query: ListAgentDefinitionsQuery
  ): Promise<{ items: AgentDefinition[]; total: number }> {
    const skip = Math.max(0, query.skip ?? 0);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const items = await this.repo.list(
      { tenantId: query.tenantId, status: query.status },
      limit,
      skip
    );
    return { items, total: items.length };
  }

  async archive(id: string, actor = 'system'): Promise<void> {
    const existing = await this.repo.getById(id);
    if (!existing) throw new AppError('agent definition not found', 404, 'AGENT_DEF_NOT_FOUND');
    await this.repo.archive(id);
    this.audit?.log(
      'agent_definition.archived',
      { id, tenantId: existing.tenantId },
      { actor: { username: actor, role: 'platform_admin' } }
    );
  }
}
