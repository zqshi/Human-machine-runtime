/**
 * AgentDefinition CRD API Client — v1.9 声明式创建
 *
 * 对齐后端 server/src/contexts/agent-core/domain/agent-definition.ts 的 AgentDefinitionSpec。
 * 底层 request 由统一 httpClient 工厂提供（超时/重试/401/JSON 安全解析）。
 * 路由前缀 /api/admin/agent-definitions（admin 聚合层，挂 authMiddleware + requireRole('platform_admin') + auditTrail）。
 *
 * 后端 CRUD：GET /(分页) | GET /:id | POST / | PUT /:id(spec,内部 bumpGeneration) | DELETE /:id(archive)
 */
import { request } from './httpClient';

/* ---------- 类型(对齐后端 agent-definition.ts) ---------- */

export type AgentRuntimeType = 'claude' | 'cockpit' | 'hermes';
export type GuardrailType = 'keyword' | 'regex' | 'intent';
export type GuardrailAction = 'block' | 'review';

export interface GuardrailRule {
  id: string;
  type: GuardrailType;
  /** 匹配模式:keyword=关键词、regex=正则源码、intent=意图描述 */
  pattern: string;
  action: GuardrailAction;
  /** 拒答原因(记审计日志,可用于回显) */
  reason: string;
}

export interface AgentPersonaSpec {
  /** 人设 system prompt(软约束,注入 worker prompt;空则不注入) */
  systemPrompt: string;
  /** 拒答规则(硬约束;空数组=无拒答) */
  guardrails: GuardrailRule[];
  /** 命中拒答时的回复话术(空则用运行时默认) */
  refusalResponse: string;
}

export interface RuntimeDeclaration {
  /** 运行时类型声明(决定走哪个 adapter;治本 D8) */
  runtimeType: AgentRuntimeType;
  /** 运行时特定配置(可选) */
  config?: Record<string, unknown>;
}

export interface ResourceModelConfig {
  primaryModel: string;
  fallbackModels: string[];
  maxConcurrency: number;
}

export interface ResourceComputeConfig {
  cpu: string;
  memory: string;
  gpu: string | null;
}

export interface ResourceBudgetConfig {
  monthlyLimitCny: number;
  dailyLimitCny: number | null;
  alertThresholdPct: number;
}

export interface ResourceStorageConfig {
  persistentVolumeSize: string;
  tempStorageSize: string;
}

export interface ResourceConfig {
  compute: ResourceComputeConfig;
  model: ResourceModelConfig;
  budget: ResourceBudgetConfig;
  storage: ResourceStorageConfig;
  source: string;
  customizedAt: string | null;
  customizedBy: string | null;
}

export type WorkspaceType = 'pvc' | 'emptyDir';

export interface WorkspaceStrategy {
  type: WorkspaceType;
  size: string;
}

export interface AgentDefinitionSpec {
  sandboxTemplate: string;
  resourceLimits: ResourceConfig;
  workspaceStrategy: WorkspaceStrategy;
  boundTools: string[];
  boundSkills: string[];
  modelConfig: ResourceModelConfig;
  /** v1.9:人设与拒答声明(#1) */
  persona: AgentPersonaSpec;
  /** v1.9:绑定知识库 id 列表(RAG 召回范围约束) */
  boundKnowledge: string[];
  /** v1.9:运行时声明(治本 D8) */
  runtime: RuntimeDeclaration;
}

export interface AgentDefinition {
  id: string;
  tenantId: string;
  name: string;
  generation: number;
  spec: AgentDefinitionSpec;
  description: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/* ---------- 枚举常量(向导 UI 用) ---------- */

export const SANDBOX_TEMPLATES = ['basic', 'high-privilege', 'network-isolated'] as const;
export const RUNTIME_TYPES: AgentRuntimeType[] = ['claude', 'cockpit', 'hermes'];
export const GUARDRAIL_TYPES: GuardrailType[] = ['keyword', 'regex', 'intent'];
export const GUARDRAIL_ACTIONS: GuardrailAction[] = ['block', 'review'];

export const RUNTIME_TYPE_LABELS: Record<AgentRuntimeType, string> = {
  claude: 'Claude (claude-worker)',
  cockpit: 'Cockpit (IM 对话)',
  hermes: 'Hermes (自定义运行时)',
};

export const SANDBOX_TEMPLATE_LABELS: Record<(typeof SANDBOX_TEMPLATES)[number], string> = {
  basic: '基础沙箱(默认,受限)',
  'high-privilege': '高权限沙箱(可写文件系统)',
  'network-isolated': '网络隔离沙箱(无外网)',
};

/**
 * 默认 spec(对齐后端 defaultAgentDefinitionSpec)。
 * 向导未编辑的字段(resourceLimits/workspaceStrategy)填此默认,
 * persona/boundKnowledge/runtime 由向导覆盖。
 */
export function defaultAgentDefinitionSpec(): AgentDefinitionSpec {
  return {
    sandboxTemplate: 'basic',
    resourceLimits: {
      compute: { cpu: '500m', memory: '512Mi', gpu: null },
      model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
      budget: { monthlyLimitCny: 0, dailyLimitCny: null, alertThresholdPct: 80 },
      storage: { persistentVolumeSize: '2Gi', tempStorageSize: '1Gi' },
      source: 'tenant_default',
      customizedAt: null,
      customizedBy: null,
    },
    workspaceStrategy: { type: 'pvc', size: '2Gi' },
    boundTools: [],
    boundSkills: [],
    modelConfig: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
    persona: { systemPrompt: '', guardrails: [], refusalResponse: '' },
    boundKnowledge: [],
    runtime: { runtimeType: 'claude' },
  };
}

/* ---------- API ---------- */

export interface ListAgentDefinitionsQuery {
  tenantId?: string;
  status?: string;
  skip?: number;
  limit?: number;
}

function listQs(query?: ListAgentDefinitionsQuery): string {
  const ps = new URLSearchParams();
  if (query?.tenantId) ps.set('tenantId', query.tenantId);
  if (query?.status) ps.set('status', query.status);
  if (query?.skip != null) ps.set('skip', String(query.skip));
  if (query?.limit != null) ps.set('limit', String(query.limit));
  const s = ps.toString();
  return s ? `?${s}` : '';
}

export const agentDefinitionApi = {
  list(query?: ListAgentDefinitionsQuery): Promise<{ items: AgentDefinition[]; total: number }> {
    return request(`/api/admin/agent-definitions${listQs(query)}`);
  },

  get(id: string): Promise<AgentDefinition> {
    return request(`/api/admin/agent-definitions/${id}`);
  },

  create(input: {
    tenantId: string;
    name: string;
    spec: AgentDefinitionSpec;
    description?: string | null;
  }): Promise<AgentDefinition> {
    return request('/api/admin/agent-definitions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** 更新 spec(后端 updateSpec 内部 generation+1,与 instance.specGeneration 对齐) */
  update(id: string, spec: AgentDefinitionSpec): Promise<AgentDefinition> {
    return request(`/api/admin/agent-definitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ spec }),
    });
  },

  archive(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/agent-definitions/${id}`, { method: 'DELETE' });
  },

  /**
   * D10:为已存在 AgentDefinition 实例化对话 instance + 同步默认 LiteLLM key。
   * 管理后台声明式向导创建 Agent 后「去对话」调用:后端生成 instance + key,
   * 前端凭返回的 instanceId 进入对话(sharedAgentChatService.openInstalledInstance)。
   * 走 control 路由(管理操作面),非 admin CRUD 路由。
   */
  instantiate(id: string): Promise<{
    agentDefinitionId: string;
    instanceId: string;
    name: string;
  }> {
    return request(`/api/control/agent-definitions/${id}/instantiate`, { method: 'POST' });
  },
};
