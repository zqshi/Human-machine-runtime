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

export interface AgentDefinitionSpec {
  sandboxTemplate: string;
  resourceLimits: ResourceConfig;
  workspaceStrategy: WorkspaceStrategy;
  boundTools: string[];
  boundSkills: string[];
  modelConfig: ResourceModelConfig;
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
