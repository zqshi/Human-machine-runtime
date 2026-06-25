/**
 * StudioService — openclaw Studio 资产聚合与 Agent 编排配置(T13)。
 *
 * 替代 routes/openclaw/studio.ts 的 STUB 假数据:接真实 DB 聚合
 * Agent(AgentDefinition) + Skill(sharedAssets) + MCP(ToolDefinition),
 * 区分 origin: created(自建) / installed(assetBindings) / shared(组织共享)。
 *
 * Agent 编排配置复用 v1.9 AgentDefinitionSpec:
 *   systemPrompt←persona, modelId←modelConfig.primaryModel,
 *   mcpRefs←boundTools, skillRefs←boundSkills, knowledgeBaseIds←boundKnowledge,
 *   openingMessage/presetQuestions/shortcuts/humanize/webSearch←runtime.config(jsonb)。
 *
 * install/uninstall 复用 shared-assets assetBindings 表(不建新表,§9.7)。
 */
import type { AgentDefinitionRepository } from '../../../db/repositories/agent-definition-repository.js';
import type { ToolDefinitionRepository } from '../../../db/repositories/tool-registry-repository.js';
import type { ISkillRepository } from '../../shared-assets/skill-service.js';
import { createAssetBinding } from '../../shared-assets/domain/shared-skill.js';

export interface AssetItem {
  id: string;
  name: string;
  type: 'Agent' | 'Skill' | 'MCP' | 'App';
  origin: 'created' | 'installed' | 'shared';
  source?: string;
  description?: string;
  version?: string;
  status: 'draft' | 'published' | 'running';
  updatedAt?: string;
  icon?: string;
}

export interface AgentConfig {
  systemPrompt: string;
  modelId: string;
  openingMessage: string;
  presetQuestions: string[];
  shortcuts: string[];
  humanize: boolean;
  webSearch: boolean;
  mcpRefs: { id: string; name: string; toolCount: number }[];
  skillRefs: { id: string; name: string; description: string }[];
  knowledgeBaseIds: string[];
  publishedVersion: string | null;
}

export class StudioService {
  constructor(
    private readonly agentDefRepo: AgentDefinitionRepository,
    private readonly toolDefRepo: ToolDefinitionRepository,
    private readonly skillRepo: ISkillRepository
  ) {}

  /** 聚合租户全部 AI 资产(自建 + 已安装 + 组织共享) */
  async listAssets(tenantId: string): Promise<AssetItem[]> {
    const items: AssetItem[] = [];

    // Agent(自建)
    const agents = await this.agentDefRepo.list({ tenantId });
    for (const a of agents) {
      items.push({
        id: a.id,
        name: a.name,
        type: 'Agent',
        origin: 'created',
        source: 'local',
        description: a.description ?? undefined,
        version: `v${a.generation}`,
        status: a.status === 'archived' ? 'draft' : 'published',
        updatedAt: a.updatedAt,
      });
    }

    // MCP(自建)
    const mcps = await this.toolDefRepo.findByTenant(tenantId);
    for (const m of mcps) {
      items.push({
        id: m.id,
        name: m.name,
        type: 'MCP',
        origin: 'created',
        source: 'local',
        description: m.summary ?? m.description ?? undefined,
        version: m.version ?? undefined,
        status: m.enabled ? 'published' : 'draft',
      });
    }

    // Skill(组织共享)
    const shared = await this.skillRepo.listSharedAssets();
    for (const s of shared) {
      items.push({
        id: s.id,
        name: s.name,
        type: s.assetType === 'tool' ? 'MCP' : 'Skill',
        origin: 'shared',
        source: 'tenant',
        description: s.description ?? undefined,
        version: s.version,
        status: s.status === 'active' ? 'published' : 'draft',
        updatedAt: s.updatedAt,
      });
    }

    // 已安装(assetBindings → 关联 sharedAssets)
    const bindings = await this.skillRepo.listBindingsByTenant(tenantId);
    const installedIds = bindings
      .map((b) => b.assetId ?? b.skillId)
      .filter((id): id is string => !!id);
    if (installedIds.length > 0) {
      const installedAssets = await this.skillRepo.getSharedAssetsByIds(installedIds);
      const assetMap = new Map(installedAssets.map((a) => [a.id, a]));
      for (const b of bindings) {
        const aid = b.assetId ?? b.skillId;
        if (!aid) continue;
        const asset = assetMap.get(aid);
        if (!asset) continue;
        items.push({
          id: aid,
          name: asset.name,
          type: asset.assetType === 'tool' ? 'MCP' : 'Skill',
          origin: 'installed',
          source: b.assetType,
          description: asset.description ?? undefined,
          version: asset.version,
          status: 'published',
          updatedAt: b.updatedAt,
        });
      }
    }

    return items;
  }

  /** 读 Agent 编排配置(映射 AgentDefinitionSpec → DTO) */
  async getAgentConfig(agentId: string): Promise<AgentConfig | null> {
    const def = await this.agentDefRepo.getById(agentId);
    if (!def) return null;
    const spec = def.spec;
    const rt = (spec.runtime.config ?? {}) as Record<string, unknown>;

    return {
      systemPrompt: spec.persona.systemPrompt ?? '',
      modelId: spec.modelConfig.primaryModel ?? 'auto',
      openingMessage: (rt.openingMessage as string) ?? '',
      presetQuestions: (rt.presetQuestions as string[]) ?? [],
      shortcuts: (rt.shortcuts as string[]) ?? [],
      humanize: (rt.humanize as boolean) ?? false,
      webSearch: (rt.webSearch as boolean) ?? false,
      mcpRefs: await this.resolveMcpRefs(spec.boundTools),
      skillRefs: await this.resolveSkillRefs(spec.boundSkills),
      knowledgeBaseIds: spec.boundKnowledge ?? [],
      publishedVersion: def.generation ? `v${def.generation}` : null,
    };
  }

  /** 保存 Agent 编排配置(草稿,映射 DTO → AgentDefinitionSpec) */
  async saveAgentConfig(agentId: string, config: Partial<AgentConfig>): Promise<boolean> {
    const def = await this.agentDefRepo.getById(agentId);
    if (!def) return false;
    const spec = def.spec;

    if (config.systemPrompt !== undefined) spec.persona.systemPrompt = config.systemPrompt;
    if (config.modelId !== undefined) spec.modelConfig.primaryModel = config.modelId;
    if (config.mcpRefs !== undefined) spec.boundTools = config.mcpRefs.map((m) => m.id);
    if (config.skillRefs !== undefined) spec.boundSkills = config.skillRefs.map((s) => s.id);
    if (config.knowledgeBaseIds !== undefined) spec.boundKnowledge = config.knowledgeBaseIds;

    // 扩展字段(openingMessage/presetQuestions/shortcuts/humanize/webSearch)存 runtime.config(jsonb)
    const rtConfig: Record<string, unknown> = { ...(spec.runtime.config ?? {}) };
    if (config.openingMessage !== undefined) rtConfig.openingMessage = config.openingMessage;
    if (config.presetQuestions !== undefined) rtConfig.presetQuestions = config.presetQuestions;
    if (config.shortcuts !== undefined) rtConfig.shortcuts = config.shortcuts;
    if (config.humanize !== undefined) rtConfig.humanize = config.humanize;
    if (config.webSearch !== undefined) rtConfig.webSearch = config.webSearch;
    spec.runtime = { runtimeType: spec.runtime.runtimeType, config: rtConfig };

    await this.agentDefRepo.updateSpec(agentId, spec);
    return true;
  }

  /** 发布 Agent 配置(updateSpec 递增 generation 作版本快照) */
  async publishAgent(agentId: string, version: string): Promise<{ version: string } | null> {
    const def = await this.agentDefRepo.getById(agentId);
    if (!def) return null;
    await this.agentDefRepo.updateSpec(agentId, def.spec);
    return { version: version || `v${def.generation + 1}` };
  }

  /** 安装资产(从组织共享 → 租户,记录 assetBinding) */
  async installAsset(
    tenantId: string,
    assetId: string,
    _source: string,
    actor: string
  ): Promise<{ id: string } | null> {
    const asset = await this.skillRepo.getSharedAsset(assetId);
    if (!asset) return null;
    const existing = await this.skillRepo.findAssetBinding(tenantId, assetId);
    if (existing) return { id: existing.id };
    const binding = createAssetBinding(tenantId, assetId, asset.assetType, actor);
    await this.skillRepo.addAssetBinding(binding);
    return { id: binding.id };
  }

  /** 卸载资产(删除 assetBinding) */
  async uninstallAsset(tenantId: string, assetId: string): Promise<boolean> {
    const binding = await this.skillRepo.findAssetBinding(tenantId, assetId);
    if (!binding) return false;
    await this.skillRepo.removeAssetBinding(binding.id);
    return true;
  }

  private async resolveMcpRefs(
    ids: string[]
  ): Promise<{ id: string; name: string; toolCount: number }[]> {
    const refs: { id: string; name: string; toolCount: number }[] = [];
    for (const id of ids) {
      const def = await this.toolDefRepo.findById(id);
      refs.push({ id, name: def?.name ?? id, toolCount: def ? 1 : 0 });
    }
    return refs;
  }

  private async resolveSkillRefs(
    ids: string[]
  ): Promise<{ id: string; name: string; description: string }[]> {
    if (ids.length === 0) return [];
    const assets = await this.skillRepo.getSharedAssetsByIds(ids);
    const map = new Map(assets.map((a) => [a.id, a]));
    return ids.map((id) => {
      const a = map.get(id);
      return { id, name: a?.name ?? id, description: a?.description ?? '' };
    });
  }
}
