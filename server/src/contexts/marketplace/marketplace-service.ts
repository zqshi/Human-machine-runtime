import type { MarketplaceClient } from '../gateway/clients/marketplace-client.js';
import type { AgentDefinitionService } from '../agent-core/application/agent-definition-service.js';
import type { InstanceService } from '../tenant-instance/instance-service.js';
import {
  defaultAgentDefinitionSpec,
  type AgentDefinitionSpec,
} from '../agent-core/domain/agent-definition.js';
import { config } from '../../config/index.js';
import { logger } from '../../app/logger.js';

/** T25:installAgent 后同步默认模型 grant + LiteLLM key 的依赖(setter 延后注入,复用 PersonaProvider 模式) */
export interface MarketplaceKeySyncDeps {
  aiGatewayRepo: {
    listModels(): Promise<{ id: number; modelName: string | null; providerModelName: string | null; displayName: string }[]>;
    listGrantsByModel(modelId: number): Promise<string[]>;
    setModelGrants(
      modelId: number,
      instanceIds: string[],
      tenantId: string,
      grantedBy?: string
    ): Promise<unknown>;
    createModel(data: {
      displayName: string;
      providerType: string;
      protocolType: string;
      baseUrl: string;
      modelName?: string;
    }): Promise<{ id: number; modelName: string | null }>;
  };
  llmKeySyncService: {
    syncInstance(instanceId: string, tenantId: string): Promise<unknown>;
  };
}

/** 默认模型名(与 chat.ts DEFAULT_MODEL 对齐,marketplace agent 走 openclaw chat) */
const DEFAULT_MODEL_NAME = 'claude-sonnet-4-6';

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  downloads: number;
  rating: number;
}

export interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  capabilities: string[];
}

export interface IAuditSink {
  log(type: string, payload: Record<string, unknown>): void;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PublishRequest {
  id: string;
  skillSlug: string;
  tenantId: string;
  actor: string;
  version?: string;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface IApprovalStore {
  create(req: Omit<PublishRequest, 'id' | 'createdAt'>): Promise<PublishRequest>;
  findPending(tenantId: string): Promise<PublishRequest[]>;
  findById(id: string): Promise<PublishRequest | null>;
  update(id: string, patch: Partial<PublishRequest>): Promise<PublishRequest | null>;
}

export class MarketplaceService {
  private client: MarketplaceClient;
  private audit: IAuditSink | null;
  private approvalStore: IApprovalStore | null;
  private agentDefinitionService: AgentDefinitionService | null;
  private instanceService: InstanceService | null;
  /** T25:installAgent 后同步 grant + key 的依赖(可选,未注入则新 instance 无 key,向后兼容) */
  private keySyncDeps: MarketplaceKeySyncDeps | null = null;

  constructor(
    client: MarketplaceClient,
    audit?: IAuditSink,
    approvalStore?: IApprovalStore,
    agentDefinitionService?: AgentDefinitionService,
    instanceService?: InstanceService
  ) {
    this.client = client;
    this.audit = audit ?? null;
    this.approvalStore = approvalStore ?? null;
    this.agentDefinitionService = agentDefinitionService ?? null;
    this.instanceService = instanceService ?? null;
  }

  /** T25:延后注入 key 同步依赖(bootstrap 中 llmKeySyncService 构造后调用,避构造顺序问题) */
  setKeySyncDeps(deps: MarketplaceKeySyncDeps): void {
    this.keySyncDeps = deps;
  }

  /** 技能市场后端（marketplace）未配置时明确拒绝，而非崩溃。 */
  private requireConfigured(): void {
    if (!this.client.isConfigured()) {
      throw new Error('Marketplace backend (marketplace) not configured — set MARKETPLACE_API_URL');
    }
  }

  async listSkills(
    params: { keyword?: string; page?: number; pageSize?: number } = {}
  ): Promise<unknown> {
    this.requireConfigured();
    return this.client.listSkills({
      keyword: params.keyword,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    });
  }

  async listSkillsForTenant(
    tenantId: string,
    params: { keyword?: string; page?: number; pageSize?: number } = {}
  ): Promise<unknown> {
    this.requireConfigured();
    const result = await this.client.listSkills({
      keyword: params.keyword,
      page: params.page || 1,
      pageSize: params.pageSize || 50,
    });
    this.audit?.log('marketplace.skill.listed', { tenantId, keyword: params.keyword });
    return result;
  }

  async getSkill(id: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getSkill(id);
  }

  async searchSkills(keyword: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.searchSkills(keyword);
  }

  async requestPublish(
    skillSlug: string,
    data: { files?: Record<string, string>; version?: string; changelog?: string },
    actor: string,
    tenantId: string
  ): Promise<PublishRequest | unknown> {
    this.requireConfigured();
    if (!this.approvalStore) {
      const result = await this.client.publishSkill(skillSlug, data);
      this.audit?.log('marketplace.skill.published', { skillSlug, actor, version: data.version });
      return result;
    }

    const req = await this.approvalStore.create({
      skillSlug,
      tenantId,
      actor,
      version: data.version,
      status: 'pending',
    });
    this.audit?.log('marketplace.skill.publish_requested', {
      requestId: req.id,
      skillSlug,
      actor,
      tenantId,
    });
    return req;
  }

  async listPendingApprovals(tenantId: string): Promise<PublishRequest[]> {
    if (!this.approvalStore) return [];
    return this.approvalStore.findPending(tenantId);
  }

  async approvePublish(
    requestId: string,
    reviewer: string,
    authToken?: string
  ): Promise<PublishRequest | null> {
    this.requireConfigured();
    if (!this.approvalStore) return null;
    const req = await this.approvalStore.findById(requestId);
    if (!req || req.status !== 'pending') return null;

    await this.client.publishSkill(req.skillSlug, { version: req.version }, authToken);
    const updated = await this.approvalStore.update(requestId, {
      status: 'approved',
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
    });
    this.audit?.log('marketplace.skill.publish_approved', {
      requestId,
      skillSlug: req.skillSlug,
      reviewer,
    });
    return updated;
  }

  async rejectPublish(
    requestId: string,
    reviewer: string,
    reason?: string
  ): Promise<PublishRequest | null> {
    if (!this.approvalStore) return null;
    const req = await this.approvalStore.findById(requestId);
    if (!req || req.status !== 'pending') return null;

    const updated = await this.approvalStore.update(requestId, {
      status: 'rejected',
      reviewedBy: reviewer,
      reviewNote: reason,
      reviewedAt: new Date().toISOString(),
    });
    this.audit?.log('marketplace.skill.publish_rejected', {
      requestId,
      skillSlug: req.skillSlug,
      reviewer,
      reason,
    });
    return updated;
  }

  async publishSkill(
    slug: string,
    data: { files?: Record<string, string>; version?: string; changelog?: string },
    actor?: string,
    authToken?: string
  ): Promise<unknown> {
    this.requireConfigured();
    const result = await this.client.publishSkill(slug, data, authToken);
    this.audit?.log('marketplace.skill.published', { slug, actor, version: data.version });
    return result;
  }

  async moderateSkill(
    skillId: string,
    action: 'approve' | 'reject',
    actor: string,
    note?: string,
    authToken?: string
  ): Promise<unknown> {
    this.requireConfigured();
    const result = await this.client.moderateSkill(skillId, action, note, authToken);
    this.audit?.log('marketplace.skill.moderated', { skillId, action, actor, note });
    return result;
  }

  async downloadSkill(skillId: string, version?: string, authToken?: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.downloadSkill(skillId, version, authToken);
  }

  async getSkillStats(skillId: string, authToken?: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getSkillStats(skillId, authToken);
  }

  async listAgents(
    params: { keyword?: string; page?: number; pageSize?: number } = {}
  ): Promise<unknown> {
    this.requireConfigured();
    return this.client.listAgents({
      keyword: params.keyword,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    });
  }

  async getAgent(id: string): Promise<unknown> {
    this.requireConfigured();
    return this.client.getAgent(id);
  }

  async getModerationQueue(
    params?: { type?: string; page?: number; pageSize?: number },
    authToken?: string
  ): Promise<unknown> {
    this.requireConfigured();
    return this.client.adminModerationQueue(params, authToken);
  }

  /**
   * 安装市场 Agent 为可运行实例(T20b-A,治本 D9):
   * marketplace agent 模板 → AgentDefinition(声明式 CRD,persona/runtime/boundTools 填默认)
   * → createInstance 关联 agentDefinitionId。跨 context 编排 agent-core + tenant-instance。
   *
   * 返回 instanceId 供前端 sharedAgentChatService.openInstalledInstance → 设置 openclawStore
   * .activeInstanceId → useAgentChat chat 请求带真 instanceId → chat route 拉 persona/apiKey/guardrail
   * 真响应(替代原 setDock 空跳转)。详见 docs/architecture/t20a-marketplace-chat-decision.md。
   *
   * 不调 requireConfigured:agent 数据由 route 层先 getAgent 拉取传入,本方法纯本地落库。
   */
  async installAgent(
    agent: { id: string; name: string; description?: string },
    tenantId: string,
    actor: string
  ): Promise<{ agentDefinitionId: string; instanceId: string; name: string }> {
    if (!this.agentDefinitionService || !this.instanceService) {
      throw new Error(
        'installAgent requires agentDefinitionService + instanceService (not configured in bootstrap)'
      );
    }
    const base = defaultAgentDefinitionSpec();
    const spec: AgentDefinitionSpec = {
      ...base,
      persona: {
        ...base.persona,
        systemPrompt: `你是${agent.name}，${agent.description || '一个 AI 助手'}。`,
      },
      // marketplace agent 走 openclaw chat 对话路径(chat route 按 instanceId 拉 persona/apiKey)
      runtime: { runtimeType: 'openclaw' },
      boundTools: [], // 市场模板未声明工具;需工具时走 AgentDefinition 编辑
    };
    const def = await this.agentDefinitionService.create(
      { tenantId, name: agent.name, spec, description: agent.description ?? null },
      actor
    );
    const inst = await this.instanceService.create({
      tenantId,
      name: agent.name,
      source: 'marketplace',
      creator: actor,
      agentDefinitionId: def.id,
    });
    this.audit?.log('marketplace.agent.installed', {
      marketplaceAgentId: agent.id,
      agentDefinitionId: def.id,
      instanceId: inst.id,
      tenantId,
      actor,
    });
    // T25:安装即对话——为新 instance 授予默认模型 grant + 同步 LiteLLM key,否则无 key→chat 502。
    // 容错:任一步失败不阻断 install 返回(同 syncOne 容错语义),仅记日志。
    await this.syncDefaultModelKey(inst.id, tenantId).catch((err) => {
      logger.warn({ instanceId: inst.id, err: err instanceof Error ? err.message : String(err) }, '[marketplace] installAgent key sync failed (non-blocking)');
    });
    return { agentDefinitionId: def.id, instanceId: inst.id, name: agent.name };
  }

  /**
   * T25:为新 instance 授予默认模型 grant + 同步 LiteLLM key。
   * 1. findOrCreateDefaultModel 解析默认模型(llm_models 无记录则建)
   * 2. listGrantsByModel 取现有 + 合并新 instance(setModelGrants 全量覆盖语义,需合并避免删别人授权)
   * 3. syncInstance 生成绑定该模型的 virtual key(LlmKeySyncService.syncOne:有 grant 才生成)
   */
  private async syncDefaultModelKey(instanceId: string, tenantId: string): Promise<void> {
    if (!this.keySyncDeps) return; // 未注入,向后兼容
    const { aiGatewayRepo, llmKeySyncService } = this.keySyncDeps;

    const modelId = await this.findOrCreateDefaultModel(aiGatewayRepo);

    // 合并现有 grants(避免 setModelGrants 全量覆盖删其他 instance 授权)
    const existing = await aiGatewayRepo.listGrantsByModel(modelId);
    if (!existing.includes(instanceId)) existing.push(instanceId);
    await aiGatewayRepo.setModelGrants(modelId, existing, tenantId, 'marketplace-install');

    // 有 grant 后同步 key(syncOne 此时生成 virtual key)
    await llmKeySyncService.syncInstance(instanceId, tenantId);
  }

  /** T25:解析默认模型——llm_models 找 modelName=DEFAULT_MODEL_NAME,无则 createModel 建 */
  private async findOrCreateDefaultModel(
    aiGatewayRepo: MarketplaceKeySyncDeps['aiGatewayRepo']
  ): Promise<number> {
    const models = await aiGatewayRepo.listModels();
    const hit = models.find((m) => m.modelName === DEFAULT_MODEL_NAME);
    if (hit) return hit.id;
    // llm_models 无默认模型记录(实测时表为空)→ 建一个指向 LiteLLM 的占位记录
    const created = await aiGatewayRepo.createModel({
      displayName: DEFAULT_MODEL_NAME,
      providerType: 'litellm',
      protocolType: 'openai',
      baseUrl: config.litellm.baseUrl,
      modelName: DEFAULT_MODEL_NAME,
    });
    return created.id;
  }
}
