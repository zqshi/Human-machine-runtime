import { newId, nowIso } from '../../../shared/utils.js';
import type { ResourceConfig, ResourceModelConfig } from '../../tenant-instance/domain/instance.js';

/* ---------- Agent 定义 CRD(v1.3) ---------- */

/**
 * AgentDefinition — Agent 定义声明式 spec(云原生 CRD 概念)。
 *
 * 与 agent-profiles(人格展示档案)区分:本 spec 是**声明式定义**,
 * instance 通过 agentDefinitionId + agentGeneration 引用。
 *
 * spec 世代(generation):每次 spec 变更递增,与 instance.version(乐观锁)区分。
 * v1.4 组装层消费 boundTools/boundSkills/sandboxTemplate;v1.3 先落 spec + 校验。
 */

export type WorkspaceType = 'pvc' | 'emptyDir';

export interface WorkspaceStrategy {
  type: WorkspaceType;
  size: string;
}

/* ---------- v1.9:声明态扩展(persona/guardrails/runtime/knowledge) ---------- */

/**
 * GuardrailRule — 拒答规则(硬约束,运行时拦截)。配合 PersonaProvider 在 harness 执行前拦截。
 *
 * type:
 *   - keyword: 关键词包含匹配(大小写不敏感)
 *   - regex:   正则匹配
 *   - intent:  意图描述(需 LLM 复核判定,本身不直接匹配)
 *
 * action:
 *   - block:  命中直接拒答(不 dispatch,返回 refusalResponse)
 *   - review: 命中转 LLM 复核(复刻 RagContextProvider 的 LLM 判断模式)
 */
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

/**
 * AgentPersonaSpec — Agent 人设与边界声明(#1 任务边界/拒答)。
 *
 * systemPrompt 是软约束(注入 worker prompt,定义角色/能力范围/行为边界);
 * guardrails 是硬约束(运行时拦截越界请求);refusalResponse 是命中拒答时的回复话术。
 * 各字段允许空值以兼容旧 Agent(无人设=不注入、无 guardrails=不拦截)。
 */
export interface AgentPersonaSpec {
  /** 人设 system prompt(软约束,注入 worker prompt;空则不注入) */
  systemPrompt: string;
  /** 拒答规则(硬约束;空数组=无拒答) */
  guardrails: GuardrailRule[];
  /** 命中拒答时的回复话术(空则用运行时默认) */
  refusalResponse: string;
}

/**
 * RuntimeDeclaration — 运行时声明(治本 D8:声明态,运行时实现可替换)。
 *
 * 声明 Agent 使用的运行时类型,runtime-registry 据此路由到对应 adapter。
 * sandboxTemplate 仍在 spec 顶层(docker-worker-runner 消费),此处只声明 runtimeType。
 */
export type AgentRuntimeType = 'claude' | 'cockpit' | 'hermes';

export interface RuntimeDeclaration {
  /** 运行时类型声明(决定走哪个 adapter;治本 D8) */
  runtimeType: AgentRuntimeType;
  /** 运行时特定配置(可选,如 cockpit 版本/claude worker 镜像引用) */
  config?: Record<string, unknown>;
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
  /** v1.9:绑定知识库 id 列表(RAG 召回范围约束;空=不限) */
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

export interface AgentDefinitionValidationError {
  field: string;
  message: string;
}

const SANDBOX_TEMPLATES = ['basic', 'high-privilege', 'network-isolated'];
const WORKSPACE_SIZES = ['1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi'];

/** 校验 spec(轻量:结构与枚举,v1.3 不重复 ResourceConfig 细校验,由 instance 侧做) */
export function validateAgentDefinitionSpec(
  spec: AgentDefinitionSpec
): AgentDefinitionValidationError[] {
  const errors: AgentDefinitionValidationError[] = [];

  if (!SANDBOX_TEMPLATES.includes(spec.sandboxTemplate)) {
    errors.push({
      field: 'sandboxTemplate',
      message: `invalid: ${spec.sandboxTemplate}, allowed: ${SANDBOX_TEMPLATES.join('/')}`,
    });
  }

  if (!WORKSPACE_SIZES.includes(spec.workspaceStrategy.size)) {
    errors.push({
      field: 'workspaceStrategy.size',
      message: `invalid: ${spec.workspaceStrategy.size}`,
    });
  }

  if (!Array.isArray(spec.boundTools)) {
    errors.push({ field: 'boundTools', message: 'must be string[]' });
  }
  if (!Array.isArray(spec.boundSkills)) {
    errors.push({ field: 'boundSkills', message: 'must be string[]' });
  }

  if (!spec.modelConfig.primaryModel) {
    errors.push({ field: 'modelConfig.primaryModel', message: 'required' });
  }
  if (spec.modelConfig.maxConcurrency < 1 || spec.modelConfig.maxConcurrency > 100) {
    errors.push({ field: 'modelConfig.maxConcurrency', message: 'must be 1-100' });
  }

  // v1.9:persona 校验(人设/拒答声明,#1)
  if (!spec.persona || typeof spec.persona !== 'object') {
    errors.push({ field: 'persona', message: 'required' });
  } else {
    if (typeof spec.persona.systemPrompt !== 'string') {
      errors.push({ field: 'persona.systemPrompt', message: 'must be string' });
    }
    if (typeof spec.persona.refusalResponse !== 'string') {
      errors.push({ field: 'persona.refusalResponse', message: 'must be string' });
    }
    if (!Array.isArray(spec.persona.guardrails)) {
      errors.push({ field: 'persona.guardrails', message: 'must be GuardrailRule[]' });
    } else {
      spec.persona.guardrails.forEach((g, i) => {
        if (!g.id) errors.push({ field: `persona.guardrails[${i}].id`, message: 'required' });
        if (!['keyword', 'regex', 'intent'].includes(g.type)) {
          errors.push({ field: `persona.guardrails[${i}].type`, message: 'invalid' });
        }
        if (typeof g.pattern !== 'string' || g.pattern === '') {
          errors.push({ field: `persona.guardrails[${i}].pattern`, message: 'required' });
        }
        if (!['block', 'review'].includes(g.action)) {
          errors.push({ field: `persona.guardrails[${i}].action`, message: 'invalid' });
        }
        if (typeof g.reason !== 'string') {
          errors.push({ field: `persona.guardrails[${i}].reason`, message: 'must be string' });
        }
      });
    }
  }

  // v1.9:boundKnowledge
  if (!Array.isArray(spec.boundKnowledge)) {
    errors.push({ field: 'boundKnowledge', message: 'must be string[]' });
  }

  // v1.9:runtime 声明(治本 D8)
  if (!spec.runtime || typeof spec.runtime !== 'object') {
    errors.push({ field: 'runtime', message: 'required' });
  } else if (!['claude', 'cockpit', 'hermes'].includes(spec.runtime.runtimeType)) {
    errors.push({ field: 'runtime.runtimeType', message: 'invalid' });
  }

  return errors;
}

export function defaultAgentDefinitionSpec(): AgentDefinitionSpec {
  return {
    sandboxTemplate: 'basic',
    resourceLimits: defaultResourceLimits(),
    workspaceStrategy: { type: 'pvc', size: '2Gi' },
    boundTools: [],
    boundSkills: [],
    modelConfig: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
    // v1.9:人设/拒答/知识/运行时 默认值(全空/默认运行时,兼容旧 Agent)
    persona: {
      systemPrompt: '',
      guardrails: [],
      refusalResponse: '',
    },
    boundKnowledge: [],
    runtime: { runtimeType: 'claude' },
  };
}

/** 默认资源限制(复用 instance.domain 的默认值,保持一致) */
function defaultResourceLimits(): ResourceConfig {
  return {
    compute: { cpu: '500m', memory: '512Mi', gpu: null },
    model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
    budget: { monthlyLimitCny: 0, dailyLimitCny: null, alertThresholdPct: 80 },
    storage: { persistentVolumeSize: '2Gi', tempStorageSize: '1Gi' },
    source: 'tenant_default',
    customizedAt: null,
    customizedBy: null,
  };
}

export interface CreateAgentDefinitionInput {
  tenantId: string;
  name: string;
  spec: AgentDefinitionSpec;
  description?: string | null;
}

export function createAgentDefinition(input: CreateAgentDefinitionInput): AgentDefinition {
  const now = nowIso();
  return {
    id: newId('adef'),
    tenantId: input.tenantId,
    name: input.name.trim(),
    generation: 1,
    spec: input.spec,
    description: input.description ?? null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

/** spec 变更:generation 递增(新世代,引用方需感知) */
export function bumpGeneration(def: AgentDefinition): AgentDefinition {
  return { ...def, generation: def.generation + 1, updatedAt: nowIso() };
}
