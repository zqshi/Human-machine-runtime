/**
 * agentDefinitionUseCase — Agent 定义创建/更新用例(application 层,纯函数,依赖注入)。
 *
 * 复用 createOrganizationEmployee 模式:纯函数 + deps 注入,不依赖 React。
 * 封装 spec 构造(表单 → AgentDefinitionSpec)+ create/update 分支 + instantiate。
 * UI 跳转(openAgentManagement/openInstalledInstance)留组件,use case 只管 API + 业务。
 *
 * T46(P1-5):AgentCreateFlow 去 infrastructure 直调。
 */
import {
  agentDefinitionApi,
  defaultAgentDefinitionSpec,
  type AgentDefinition,
  type AgentDefinitionSpec,
  type AgentRuntimeType,
  type GuardrailRule,
} from '../services/adminApi';

type AgentDefinitionApi = typeof agentDefinitionApi;

/** 创建表单草稿(组件表单状态 → use case 构造 spec) */
export interface AgentCreateFormDraft {
  sandboxTemplate: string;
  primaryModel: string;
  fallbackModels: string[];
  maxConcurrency: number;
  systemPrompt: string;
  guardrails: GuardrailRule[];
  refusalResponse: string;
  boundSkills: string[];
  boundKnowledge: string[];
  boundTools: string[];
  runtimeType: AgentRuntimeType;
}

/** 实例化结果(instantiate 返回) */
export interface AgentInstantiateResult {
  instanceId: string;
  name: string;
}

export interface AgentDefinitionUseCaseDeps {
  agentDefinitionApi: AgentDefinitionApi;
}

const defaultDeps: AgentDefinitionUseCaseDeps = { agentDefinitionApi };

/**
 * 表单草稿 → AgentDefinitionSpec(业务规则:过滤空 guardrail、primaryModel 空兜底 auto)。
 * 未编辑字段(resourceLimits/workspaceStrategy)用 defaultAgentDefinitionSpec 默认。
 */
export function buildAgentDefinitionSpec(form: AgentCreateFormDraft): AgentDefinitionSpec {
  return {
    ...defaultAgentDefinitionSpec(),
    sandboxTemplate: form.sandboxTemplate,
    modelConfig: {
      primaryModel: form.primaryModel.trim() || 'auto',
      fallbackModels: form.fallbackModels,
      maxConcurrency: form.maxConcurrency,
    },
    persona: {
      systemPrompt: form.systemPrompt,
      guardrails: form.guardrails.filter((g) => g.pattern.trim()),
      refusalResponse: form.refusalResponse,
    },
    boundSkills: form.boundSkills,
    boundKnowledge: form.boundKnowledge,
    boundTools: form.boundTools,
    runtime: { runtimeType: form.runtimeType },
  };
}

/**
 * 创建或更新 Agent 定义:有 definitionId 走 update(bumpGeneration),否则 create。
 * create 需 tenantId;update 不需要(definitionId 已定位)。
 */
export async function createOrUpdateAgentDefinition(
  params: {
    definitionId?: string;
    tenantId?: string;
    name: string;
    description: string;
    spec: AgentDefinitionSpec;
  },
  deps: AgentDefinitionUseCaseDeps = defaultDeps
): Promise<AgentDefinition> {
  if (params.definitionId) {
    return deps.agentDefinitionApi.update(params.definitionId, params.spec);
  }
  return deps.agentDefinitionApi.create({
    tenantId: params.tenantId!,
    name: params.name,
    spec: params.spec,
    description: params.description || null,
  });
}

/** 实例化 Agent 定义为可对话 instance(新建后 openInstalledInstance 接对话页)。 */
export async function instantiateAgentDefinition(
  definitionId: string,
  deps: AgentDefinitionUseCaseDeps = defaultDeps
): Promise<AgentInstantiateResult> {
  return deps.agentDefinitionApi.instantiate(definitionId);
}
