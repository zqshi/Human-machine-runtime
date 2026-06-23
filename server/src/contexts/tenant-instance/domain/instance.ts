import { newId, nowIso } from '../../../shared/utils.js';
import type { TenantQuotas } from '../../tenant-management/domain/tenant.js';

/* ---------- State enum ---------- */

export const STATE = {
  REQUESTED: 'requested',
  PROVISIONING: 'provisioning',
  RUNNING: 'running',
  STOPPED: 'stopped',
  FAILED: 'failed',
} as const;

export type InstanceState = (typeof STATE)[keyof typeof STATE];

/* ---------- Instance entity ---------- */

export interface Instance {
  id: string;
  tenantId: string;
  name: string;
  source: string;
  matrixRoomId: string | null;
  creator: string;
  enterpriseUserId: string | null;
  employeeNo: string;
  employeeId: string;
  email: string | null;
  jobCode: string;
  jobTitle: string;
  department: string;
  departmentId: string | null;
  permissionTemplateId: string;
  permissionTemplate: Record<string, unknown> | null;
  state: InstanceState;
  runtime: Record<string, unknown>;
  resources: ResourceConfig;
  policy: Record<string, unknown>;
  approvalPolicy: Record<string, unknown>;
  farmInstanceId?: string | null;
  farmPodName?: string | null;
  farmNamespace?: string | null;
  requestId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  /** 乐观锁版本号：每次 save 自增，CAS 防止并发覆写 */
  version: number;
  /** v1.3:关联的 Agent 定义 CRD id(声明式 spec;可空,旧实例不引用) */
  agentDefinitionId?: string | null;
  /** v1.3:引用 Agent 定义时的 spec 世代(与 agent_definitions.generation 对齐) */
  agentGeneration?: number | null;
}

/* ---------- Resource config ---------- */

export type ResourceSource = 'tenant_default' | 'custom';

export interface ResourceComputeConfig {
  cpu: string;
  memory: string;
  gpu: { type: string; count: number } | null;
}

export interface ResourceModelConfig {
  primaryModel: string;
  fallbackModels: string[];
  maxConcurrency: number;
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
  source: ResourceSource;
  customizedAt: string | null;
  customizedBy: string | null;
}

export function defaultResourceConfig(): ResourceConfig {
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

export function resourceConfigFromTenantQuotas(quotas: TenantQuotas): ResourceConfig {
  return {
    compute: { cpu: quotas.instanceCpu, memory: quotas.instanceMemory, gpu: null },
    model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
    budget: {
      monthlyLimitCny: quotas.tokenBudgetMonthly,
      dailyLimitCny: quotas.tokenBudgetDaily || null,
      alertThresholdPct: 80,
    },
    storage: { persistentVolumeSize: quotas.instanceStorage, tempStorageSize: '1Gi' },
    source: 'tenant_default',
    customizedAt: null,
    customizedBy: null,
  };
}

const CPU_VALUES = ['250m', '500m', '1000m', '2000m', '4000m'];
const MEMORY_VALUES = ['256Mi', '512Mi', '1Gi', '2Gi', '4Gi', '8Gi'];
const STORAGE_VALUES = ['1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi'];

export interface ResourceValidationError {
  field: string;
  message: string;
}

export function validateResourceConfig(
  config: ResourceConfig,
  tenantQuotas: TenantQuotas
): ResourceValidationError[] {
  const errors: ResourceValidationError[] = [];

  if (!CPU_VALUES.includes(config.compute.cpu)) {
    errors.push({ field: 'compute.cpu', message: `invalid cpu: ${config.compute.cpu}` });
  }
  if (!MEMORY_VALUES.includes(config.compute.memory)) {
    errors.push({ field: 'compute.memory', message: `invalid memory: ${config.compute.memory}` });
  }

  const cpuIdx = CPU_VALUES.indexOf(config.compute.cpu);
  const maxCpuIdx = CPU_VALUES.indexOf(tenantQuotas.instanceCpu);
  if (cpuIdx >= 0 && maxCpuIdx >= 0 && cpuIdx > maxCpuIdx) {
    errors.push({
      field: 'compute.cpu',
      message: `exceeds tenant limit: ${tenantQuotas.instanceCpu}`,
    });
  }

  const memIdx = MEMORY_VALUES.indexOf(config.compute.memory);
  const maxMemIdx = MEMORY_VALUES.indexOf(tenantQuotas.instanceMemory);
  if (memIdx >= 0 && maxMemIdx >= 0 && memIdx > maxMemIdx) {
    errors.push({
      field: 'compute.memory',
      message: `exceeds tenant limit: ${tenantQuotas.instanceMemory}`,
    });
  }

  if (!config.model.primaryModel) {
    errors.push({ field: 'model.primaryModel', message: 'primaryModel is required' });
  }
  if (config.model.maxConcurrency < 1 || config.model.maxConcurrency > 100) {
    errors.push({ field: 'model.maxConcurrency', message: 'must be 1-100' });
  }

  if (config.budget.monthlyLimitCny < 0) {
    errors.push({ field: 'budget.monthlyLimitCny', message: 'cannot be negative' });
  }
  if (config.budget.alertThresholdPct < 1 || config.budget.alertThresholdPct > 100) {
    errors.push({ field: 'budget.alertThresholdPct', message: 'must be 1-100' });
  }

  if (!STORAGE_VALUES.includes(config.storage.persistentVolumeSize)) {
    errors.push({
      field: 'storage.persistentVolumeSize',
      message: `invalid: ${config.storage.persistentVolumeSize}`,
    });
  }

  return errors;
}

export function isCustomResource(instance: Instance): boolean {
  return instance.resources.source === 'custom';
}

export function applyResourceConfig(
  instance: Instance,
  patch: Partial<ResourceConfig>,
  actor: string
): Instance {
  const merged: ResourceConfig = {
    compute: { ...instance.resources.compute, ...patch.compute },
    model: { ...instance.resources.model, ...patch.model },
    budget: { ...instance.resources.budget, ...patch.budget },
    storage: { ...instance.resources.storage, ...patch.storage },
    source: 'custom',
    customizedAt: nowIso(),
    customizedBy: actor,
  };
  return { ...touch(instance), resources: merged };
}

export function resetResourceConfig(instance: Instance, tenantQuotas: TenantQuotas): Instance {
  return { ...touch(instance), resources: resourceConfigFromTenantQuotas(tenantQuotas) };
}

/* ---------- Pure helpers ---------- */

export function normalizeMatrixLocalpart(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const noAt = raw.startsWith('@') ? raw.slice(1) : raw;
  const idx = noAt.indexOf(':');
  return idx >= 0 ? noAt.slice(0, idx) : noAt;
}

export function inferDepartmentByJob(jobTitle: unknown): string {
  const title = String(jobTitle ?? '').trim();
  if (!title) return 'general';
  if (title.includes('财务')) return 'finance';
  if (title.includes('采购')) return 'procurement';
  if (title.includes('法务')) return 'legal';
  if (title.includes('人事') || title.includes('HR')) return 'human-resources';
  if (title.includes('运维')) return 'operations';
  if (title.includes('开发') || title.includes('工程')) return 'engineering';
  if (title.includes('测试')) return 'quality';
  if (title.includes('销售')) return 'sales';
  if (title.includes('运营')) return 'operations';
  if (title.includes('产品')) return 'product';
  return 'general';
}

export function generateEmployeeNo(): string {
  const d = new Date();
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `DE${y}${m}${day}${seq}`;
}

/* ---------- Create / touch ---------- */

export interface CreateInstanceInput {
  tenantId: string;
  name: string;
  source?: string;
  matrixRoomId?: string | null;
  creator: string;
  enterpriseUserId?: string | null;
  employeeNo?: string;
  employeeId?: string;
  email?: string | null;
  jobCode?: string;
  jobTitle?: string;
  department?: string;
  departmentId?: string | null;
  permissionTemplateId?: string;
  permissionTemplate?: Record<string, unknown> | null;
  requestId?: string | null;
}

export interface CreateInstanceConfig {
  defaultSource?: string;
}

export function createInstance(input: CreateInstanceInput, cfg?: CreateInstanceConfig): Instance {
  const now = nowIso();
  const jobTitle = String(input.jobTitle ?? '').trim();
  const department = String(input.department ?? '').trim() || inferDepartmentByJob(jobTitle);
  const employeeNo = input.employeeNo || generateEmployeeNo();
  const employeeId = input.employeeId || employeeNo;

  return {
    id: newId('inst'),
    tenantId: input.tenantId,
    name: String(input.name || '').trim(),
    source: input.source ?? cfg?.defaultSource ?? 'api',
    matrixRoomId: input.matrixRoomId ?? null,
    creator: input.creator,
    enterpriseUserId: input.enterpriseUserId ?? null,
    employeeNo,
    employeeId,
    email: input.email ?? null,
    jobCode: String(input.jobCode ?? '').trim(),
    jobTitle,
    department,
    departmentId: input.departmentId ?? null,
    permissionTemplateId: input.permissionTemplateId ?? '',
    permissionTemplate: input.permissionTemplate ?? null,
    state: STATE.REQUESTED,
    runtime: {},
    resources: defaultResourceConfig(),
    policy: {},
    approvalPolicy: {},
    requestId: input.requestId ?? null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };
}

export function touch(instance: Instance): Instance {
  return { ...instance, updatedAt: nowIso() };
}
