/**
 * 组装层装配(v1.4)。
 *
 * 把 InstanceRepository / AgentDefinitionRepository / ToolDefinitionRepository / SkillRepository
 * 适配成 agent-core domain 的 4 个 port(IInstanceLookupPort / IAgentDefinitionPort /
 * IBoundToolsPort / IContentStorePort),注入 AssemblyProvider。
 *
 * 从 bootstrap.ts 拆出(模式同 rag-provider.ts / credentials.ts)。
 */
import { logger } from '../logger.js';
import { AssemblyProvider } from '../../contexts/agent-core/domain/assembly-provider.js';
import type {
  IInstanceLookupPort,
  IAgentDefinitionPort,
  IBoundToolsPort,
  IContentStorePort,
  IAssemblyProvider,
} from '../../contexts/agent-core/domain/assembly-provider.js';
import type { InstanceRepository } from '../../db/repositories/instance-repository.js';
import type { AgentDefinitionRepository } from '../../db/repositories/agent-definition-repository.js';
import type { ToolDefinitionRepository } from '../../db/repositories/tool-registry-repository.js';
import type { SkillRepository } from '../../db/repositories/skill-repository.js';

/** InstanceRepository → IInstanceLookupPort(只暴露 getAgentDefinitionId) */
export function adaptInstanceLookup(repo: InstanceRepository): IInstanceLookupPort {
  return {
    async getAgentDefinitionId(instanceId) {
      // InstanceRepository.findById 返回 Instance(含 agentDefinitionId,v1.3 加)
      const inst = await repo.findById(instanceId);
      return inst?.agentDefinitionId ?? null;
    },
  };
}

/** AgentDefinitionRepository → IAgentDefinitionPort */
export function adaptAgentDefinition(repo: AgentDefinitionRepository): IAgentDefinitionPort {
  return { getById: (id) => repo.getById(id) };
}

/** ToolDefinitionRepository → IBoundToolsPort(v2.0:export 供 BakingService 复用,不重发明) */
export function adaptBoundTools(repo: ToolDefinitionRepository): IBoundToolsPort {
  return {
    async findByIds(ids) {
      const rows = await repo.findByIds(ids);
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        status: r.status,
        tenantId: r.tenantId,
        // T18b-A:透传 description/inputSchema 供组装层产出 externalTools(worker custom tool 定义)
        description: r.description ?? null,
        inputSchema: (r.inputSchema as Record<string, unknown> | null) ?? null,
      }));
    },
  };
}

/** SkillRepository → IContentStorePort(v2.0:export 供 BakingService 复用,不重发明) */
export function adaptContentStore(repo: SkillRepository): IContentStorePort {
  return {
    async getByIds(ids) {
      const assets = await repo.getSharedAssetsByIds(ids);
      return assets.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        content: a.content,
        contentRef: a.contentRef,
      }));
    },
  };
}

export function buildAssemblyProvider(
  instanceRepo: InstanceRepository,
  agentDefinitionRepo: AgentDefinitionRepository,
  toolDefinitionRepo: ToolDefinitionRepository,
  skillRepo: SkillRepository
): IAssemblyProvider {
  return new AssemblyProvider(
    adaptInstanceLookup(instanceRepo),
    adaptAgentDefinition(agentDefinitionRepo),
    adaptBoundTools(toolDefinitionRepo),
    adaptContentStore(skillRepo),
    { warn: (msg) => logger.warn({ component: 'assembly-provider' }, msg) }
  );
}
