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
  /**
   * v1.8:期望态(声明 desired)。与 state(actual)分离后,reconciler 按 desired→actual
   * diff 异步调和。默认与 state 同步(无 drift);声明变更只动 desired,actual 由调和跟随。
   */
  desiredState: InstanceState;
  /**
   * v1.8:spec 世代(覆盖 resources/policy/agentDefinition 整体维度)。每次声明态变更 +1,
   * reconciler 据此检测 spec 是否变过——区别于 version(乐观锁)与 agentGeneration(仅 agent 定义维度)。
   */
  specGeneration: number;
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
    desiredState: STATE.REQUESTED,
    specGeneration: 0,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };
}

export function touch(instance: Instance): Instance {
  return { ...instance, updatedAt: nowIso() };
}

/* ---------- v1.8: desired / spec generation (reconcile 原语) ---------- */

/**
 * 设置期望态(声明)。仅改 desiredState,不动 actual state —— 实际调和由 reconciler
 * 异步执行(InstanceService.reconcile / instance-reconciler controller),actual 跟随 desired。
 */
export function setDesiredState(instance: Instance, desired: InstanceState): Instance {
  return { ...touch(instance), desiredState: desired };
}

/**
 * 自增 spec 世代。声明态变更(resources/policy/agentDefinition)后调用,标记 desired spec 已变;
 * reconciler 检测到世代变更触发增量调和或 rebuild。
 */
export function bumpSpecGeneration(instance: Instance): Instance {
  return { ...touch(instance), specGeneration: instance.specGeneration + 1 };
}

/**
 * 期望态 vs 实际态 drift 判定(reconcile 触发条件之一)。
 * 完整的 action 决策(reconcile/stop/rebuild/noop)见 reconcile 决策逻辑,由 application 层编排。
 */
export function hasStateDrift(instance: Instance): boolean {
  return instance.desiredState !== instance.state;
}

/* ---------- v1.8: reconcile 决策(纯函数,编排核心) ---------- */

export type ReconcileAction = 'noop' | 'start' | 'stop' | 'reconcile';

/**
 * actual runtime 已调和到的 spec 世代(存于 runtime.reconciledSpecGeneration)。
 * 未调和(无记录)返回 -1,使任意 specGeneration>=0 首次都判定为 drift。
 */
export function getReconciledSpecGeneration(instance: Instance): number {
  const v = instance.runtime.reconciledSpecGeneration;
  return typeof v === 'number' ? v : -1;
}

/** 连续 reconcile 失败次数(存于 runtime.reconcileFailures),用于 rebuild 兜底阈值判断 */
export function getReconcileFailures(instance: Instance): number {
  const v = instance.runtime.reconcileFailures;
  return typeof v === 'number' ? v : 0;
}

/**
 * 声明→运行 diff 决策。基于 desiredState/state/specGeneration 与已调和世代输出动作:
 * - stop:期望停止,实际未停 → teardown(actual 跟随到 STOPPED)
 * - start:期望运行,实际未跑(PROVISIONING 中除外)→ provision
 * - reconcile:spec 漂移(specGeneration≠已调和世代)且期望运行已在跑 → 增量调和
 * - noop:无 drift
 *
 * 不依赖 provisioner 能力(纯逻辑);provisioner 能否真增量由各自 reconcile 实现,
 * 失败由 application 层计数触发 rebuild 兜底。
 */
export function decideReconcileAction(instance: Instance): ReconcileAction {
  const { desiredState: desired, state: actual, specGeneration } = instance;
  const specChanged = getReconciledSpecGeneration(instance) !== specGeneration;

  if (desired === STATE.STOPPED && actual !== STATE.STOPPED) return 'stop';
  if (desired === STATE.RUNNING && actual !== STATE.RUNNING && actual !== STATE.PROVISIONING) {
    return 'start';
  }
  if (specChanged && desired === STATE.RUNNING && actual === STATE.RUNNING) return 'reconcile';
  return 'noop';
}

/**
 * 标记 runtime 已调和到指定 spec 世代并重置失败计数(调和成功后调用)。
 * 清除 lastReconcileError(失败痕迹),保留其余 runtime 字段(如 pid/podName)。
 */
export function withReconciled(
  runtime: Record<string, unknown>,
  specGeneration: number,
  failures = 0
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...runtime };
  delete next.lastReconcileError;
  next.reconciledSpecGeneration = specGeneration;
  next.reconcileFailures = failures;
  return next;
}
