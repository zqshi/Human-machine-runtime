import {
  type Instance,
  type CreateInstanceInput,
  type ResourceConfig,
  STATE,
  createInstance,
  touch,
  normalizeMatrixLocalpart,
  applyResourceConfig,
  resetResourceConfig,
  validateResourceConfig,
  decideReconcileAction,
  getReconcileFailures,
  withReconciled,
  bumpSpecGeneration,
} from './domain/instance.js';
import type { TenantQuotas } from '../tenant-management/domain/tenant.js';
import { nowIso, AppError } from '../../shared/utils.js';

/* ---------- Repository interface ---------- */

export interface IInstanceRepository {
  findAll(tenantId?: string, resourceSource?: string): Promise<Instance[]>;
  findById(id: string): Promise<Instance | undefined>;
  save(instance: Instance): Promise<number>;
  delete(id: string): Promise<void>;
}

/* ---------- Provisioner interface ---------- */

/**
 * v1.8:远端真实运行态。reconciler / health-monitor 据此判断 actual,与 desired 对比。
 * - running:远端进程/pod 健康在跑
 * - stopped:远端已停止(但资源可能还在)
 * - unknown:查询失败,无法判断(查询容错,不应阻断)
 */
export interface InstanceRemoteStatus {
  state: 'running' | 'stopped' | 'unknown';
  detail?: Record<string, unknown>;
}

export interface IInstanceProvisioner {
  provision(instance: Instance): Promise<Record<string, unknown>>;
  teardown(instance: Instance): Promise<void>;
  /**
   * v1.8:增量调和——按当前声明态(desired spec)尽力调整运行态(actual),返回更新后的 runtime。
   * 处理状态级调和(start/确认 running);spec 级变更(扩容等)若 provisioner 底层不支持,
   * 由上层 InstanceService.reconcile 决策降级为 rebuild。失败须抛出,reconciler 计数后触发兜底。
   */
  reconcile(instance: Instance): Promise<Record<string, unknown>>;
  /**
   * v1.8:查询远端真实运行态。容错:查询失败返回 {state:'unknown'} 而非抛出(查询不应崩)。
   * 未配置或无远端实现返回 null。
   */
  getRemoteStatus(instance: Instance): Promise<InstanceRemoteStatus | null>;
}

/* ---------- Audit interface ---------- */

export interface IAuditLogger {
  log(event: {
    action: string;
    instanceId: string;
    tenantId: string;
    actor: string;
    detail?: Record<string, unknown>;
    timestamp: string;
  }): void;
}

/* ---------- Tenant quota lookup ---------- */

export interface ITenantQuotaLookup {
  getQuotas(tenantId: string): Promise<TenantQuotas>;
}

/* ---------- Service ---------- */

export class InstanceService {
  private repo: IInstanceRepository;
  private provisioner: IInstanceProvisioner | null;
  private audit: IAuditLogger | null;
  private tenantQuotaLookup: ITenantQuotaLookup | null;

  constructor(
    repo: IInstanceRepository,
    provisioner?: IInstanceProvisioner,
    audit?: IAuditLogger,
    tenantQuotaLookup?: ITenantQuotaLookup
  ) {
    this.repo = repo;
    this.provisioner = provisioner ?? null;
    this.audit = audit ?? null;
    this.tenantQuotaLookup = tenantQuotaLookup ?? null;
  }

  /* ---- query ---- */

  async list(tenantId?: string, resourceSource?: string): Promise<Instance[]> {
    return this.repo.findAll(tenantId, resourceSource);
  }

  async get(instanceId: string): Promise<Instance> {
    const inst = await this.repo.findById(instanceId);
    if (!inst) {
      throw new AppError(`instance not found: ${instanceId}`, 404, 'INSTANCE_NOT_FOUND');
    }
    return inst;
  }

  /* ---- create ---- */

  async create(input: CreateInstanceInput): Promise<Instance> {
    await this.assertWithinInstanceQuota(input.tenantId);
    const inst = createInstance(input);
    inst.version = await this.repo.save(inst);
    this.emitAudit('instance.created', inst, input.creator);
    return inst;
  }

  async createFromMatrix(input: {
    tenantId: string;
    matrixUserId: string;
    displayName?: string;
    creator: string;
    email?: string;
    jobTitle?: string;
    department?: string;
    departmentId?: string | null;
    permissionTemplateId?: string;
    permissionTemplate?: Record<string, unknown> | null;
    requestId?: string | null;
    agentDefinitionId?: string | null;
  }): Promise<Instance> {
    const localpart = normalizeMatrixLocalpart(input.matrixUserId);
    if (!localpart) {
      throw new AppError('matrixUserId is required', 400, 'INVALID_INPUT');
    }

    await this.assertWithinInstanceQuota(input.tenantId);

    const createInput: CreateInstanceInput = {
      tenantId: input.tenantId,
      name: input.displayName || localpart,
      source: 'matrix',
      matrixRoomId: null,
      creator: input.creator,
      enterpriseUserId: input.matrixUserId,
      email: input.email ?? null,
      jobTitle: input.jobTitle,
      department: input.department,
      departmentId: input.departmentId,
      permissionTemplateId: input.permissionTemplateId,
      permissionTemplate: input.permissionTemplate,
      requestId: input.requestId,
      agentDefinitionId: input.agentDefinitionId ?? null,
    };

    const inst = createInstance(createInput, { defaultSource: 'matrix' });
    inst.version = await this.repo.save(inst);
    this.emitAudit('instance.created', inst, input.creator);
    return inst;
  }

  /* ---- lifecycle ---- */

  async start(instanceId: string): Promise<Instance> {
    const inst = await this.get(instanceId);

    if (
      inst.state !== STATE.REQUESTED &&
      inst.state !== STATE.STOPPED &&
      inst.state !== STATE.FAILED
    ) {
      throw new AppError(
        `cannot start instance in state '${inst.state}'`,
        409,
        'INVALID_STATE_TRANSITION'
      );
    }

    let updated: Instance = {
      ...touch(inst),
      state: STATE.PROVISIONING,
      lastError: null,
      desiredState: STATE.RUNNING,
    };
    updated.version = await this.repo.save(updated);

    if (this.provisioner) {
      try {
        const runtimeInfo = await this.provisioner.provision(updated);
        updated = {
          ...touch(updated),
          state: STATE.RUNNING,
          runtime: runtimeInfo,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        updated = {
          ...touch(updated),
          state: STATE.FAILED,
          lastError: message,
        };
      }
    } else {
      updated = { ...touch(updated), state: STATE.RUNNING };
    }

    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.started', updated, 'system');
    return updated;
  }

  async stop(instanceId: string): Promise<Instance> {
    const inst = await this.get(instanceId);

    if (inst.state !== STATE.RUNNING && inst.state !== STATE.PROVISIONING) {
      throw new AppError(
        `cannot stop instance in state '${inst.state}'`,
        409,
        'INVALID_STATE_TRANSITION'
      );
    }

    if (this.provisioner) {
      try {
        await this.provisioner.teardown(inst);
      } catch {
        /* best-effort teardown */
      }
    }

    const updated: Instance = {
      ...touch(inst),
      state: STATE.STOPPED,
      desiredState: STATE.STOPPED,
      runtime: {},
    };
    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.stopped', updated, 'system');
    return updated;
  }

  async rebuild(instanceId: string): Promise<Instance> {
    const inst = await this.get(instanceId);

    if (inst.state === STATE.PROVISIONING) {
      throw new AppError('cannot rebuild while provisioning', 409, 'INVALID_STATE_TRANSITION');
    }

    /* tear down if currently running */
    if (inst.state === STATE.RUNNING && this.provisioner) {
      try {
        await this.provisioner.teardown(inst);
      } catch {
        /* best-effort */
      }
    }

    let updated: Instance = {
      ...touch(inst),
      state: STATE.PROVISIONING,
      lastError: null,
      desiredState: STATE.RUNNING,
      runtime: {},
    };
    updated.version = await this.repo.save(updated);

    if (this.provisioner) {
      try {
        const runtimeInfo = await this.provisioner.provision(updated);
        updated = { ...touch(updated), state: STATE.RUNNING, runtime: runtimeInfo };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        updated = { ...touch(updated), state: STATE.FAILED, lastError: message };
      }
    } else {
      updated = { ...touch(updated), state: STATE.RUNNING };
    }

    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.rebuilt', updated, 'system');
    return updated;
  }

  /* ---- reconcile (v1.8: 声明/运行调和) ---- */

  /**
   * 声明→运行调和编排。按 desired→actual + specGeneration diff 决策动作并执行,actual 跟随 desired:
   * - stop:期望停止 → teardown,actual→STOPPED
   * - start:期望运行未跑 → 复用 start() 拉起,随后标记 spec 已应用
   * - reconcile:spec 漂移 → provisioner.reconcile 增量;失败累计 reconcileFailures,达阈值 → rebuild 兜底
   * - noop:无 drift,直接返回
   *
   * 状态调和直接生效;spec 调和(resources/policy 变更)走 provisioner.reconcile 增量——provisioner 尽力
   * (Local 真增量;Container 受上游 API 限制仅状态级,真扩容需 rebuild/上游 resize,见版本遗留)。
   */
  async reconcile(
    instanceId: string,
    opts: { failureThreshold?: number; force?: boolean } = {}
  ): Promise<Instance> {
    const threshold = opts.failureThreshold ?? 3;
    const inst = await this.get(instanceId);
    const action = decideReconcileAction(inst);

    // force:health-monitor 等已知不健康场景,跳过 noop 直接轻量调和
    // (provisioner.reconcile 尝试 start 恢复),失败由 reconcileSpec 计数→rebuild 兜底
    if (action === 'noop' && !opts.force) return inst;
    if (action === 'stop') return this.reconcileToStopped(inst);
    if (action === 'start') return this.reconcileToRunning(inst);
    return this.reconcileSpec(inst, threshold);
  }

  /** desired=stopped:teardown 让 actual 跟随,标记 spec 已调和(停止态无需 spec 应用) */
  private async reconcileToStopped(inst: Instance): Promise<Instance> {
    if (this.provisioner) {
      try {
        await this.provisioner.teardown(inst);
      } catch {
        /* best-effort teardown */
      }
    }
    const updated: Instance = {
      ...touch(inst),
      state: STATE.STOPPED,
      runtime: withReconciled(inst.runtime, inst.specGeneration),
    };
    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.reconciled.stopped', updated, 'system');
    return updated;
  }

  /** desired=running 未跑:复用 start() 拉起,标记 spec 已应用避免立即再 reconcile */
  private async reconcileToRunning(inst: Instance): Promise<Instance> {
    const started = await this.start(inst.id);
    const marked: Instance = {
      ...touch(started),
      runtime: withReconciled(started.runtime, inst.specGeneration),
    };
    marked.version = await this.repo.save(marked);
    return marked;
  }

  /** spec 漂移:provisioner.reconcile 增量调和;失败累计,达阈值 rebuild 兜底 */
  private async reconcileSpec(inst: Instance, threshold: number): Promise<Instance> {
    const failures = getReconcileFailures(inst);

    if (!this.provisioner) {
      const updated: Instance = {
        ...touch(inst),
        runtime: withReconciled(inst.runtime, inst.specGeneration),
      };
      updated.version = await this.repo.save(updated);
      return updated;
    }

    try {
      const runtimeInfo = await this.provisioner.reconcile(inst);
      const updated: Instance = {
        ...touch(inst),
        state: STATE.RUNNING,
        runtime: withReconciled({ ...inst.runtime, ...runtimeInfo }, inst.specGeneration, 0),
      };
      updated.version = await this.repo.save(updated);
      this.emitAudit('instance.reconciled', updated, 'system');
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const newFailures = failures + 1;
      const failed: Instance = {
        ...touch(inst),
        runtime: { ...inst.runtime, reconcileFailures: newFailures, lastReconcileError: message },
      };
      failed.version = await this.repo.save(failed);

      if (newFailures >= threshold) {
        this.emitAudit('instance.reconcile.fallback', failed, 'system');
        const rebuilt = await this.rebuild(inst.id);
        const marked: Instance = {
          ...touch(rebuilt),
          runtime: withReconciled(rebuilt.runtime, inst.specGeneration, 0),
        };
        marked.version = await this.repo.save(marked);
        return marked;
      }
      this.emitAudit('instance.reconcile.failed', failed, 'system');
      return failed;
    }
  }

  async remove(instanceId: string): Promise<{ id: string; deleted: true }> {
    const inst = await this.get(instanceId);

    if (inst.state === STATE.RUNNING && this.provisioner) {
      try {
        await this.provisioner.teardown(inst);
      } catch {
        /* best-effort */
      }
    }

    await this.repo.delete(instanceId);
    this.emitAudit('instance.removed', inst, 'system');
    return { id: instanceId, deleted: true };
  }

  /* ---- profile / policy ---- */

  async updateProfile(
    instanceId: string,
    profile: Record<string, unknown>,
    actor = 'system'
  ): Promise<Instance> {
    const inst = await this.get(instanceId);
    const updated: Instance = {
      ...touch(inst),
      name: (profile.name as string) || inst.name,
      department: (profile.department as string) || inst.department,
      departmentId: (profile.departmentId as string) ?? inst.departmentId,
      jobTitle: (profile.jobTitle as string) || inst.jobTitle,
      email: (profile.email as string) ?? inst.email,
    };
    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.profile.updated', updated, actor);
    return updated;
  }

  async updatePolicy(
    instanceId: string,
    policy: Record<string, unknown>,
    actor = 'system'
  ): Promise<Instance> {
    const inst = await this.get(instanceId);
    const updated: Instance = { ...touch(inst), policy };
    const specBumped = bumpSpecGeneration(updated);
    specBumped.version = await this.repo.save(specBumped);
    this.emitAudit('instance.policy.updated', specBumped, actor);
    return specBumped;
  }

  async updateApprovalPolicy(
    instanceId: string,
    approvalPolicy: Record<string, unknown>,
    actor = 'system'
  ): Promise<Instance> {
    const inst = await this.get(instanceId);
    const updated: Instance = { ...touch(inst), approvalPolicy };
    const specBumped = bumpSpecGeneration(updated);
    specBumped.version = await this.repo.save(specBumped);
    this.emitAudit('instance.approvalPolicy.updated', specBumped, actor);
    return specBumped;
  }

  /* ---- resources ---- */

  async updateResources(
    instanceId: string,
    patch: Partial<ResourceConfig>,
    actor = 'system'
  ): Promise<Instance> {
    const inst = await this.get(instanceId);
    const updated = applyResourceConfig(inst, patch, actor);

    if (this.tenantQuotaLookup) {
      const quotas = await this.tenantQuotaLookup.getQuotas(inst.tenantId);
      const errors = validateResourceConfig(updated.resources, quotas);
      if (errors.length > 0) {
        throw new AppError(
          `resource validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`,
          400,
          'RESOURCE_VALIDATION_FAILED'
        );
      }

      const siblings = await this.repo.findAll(inst.tenantId);
      const totalBudget = siblings.reduce((sum, s) => {
        const budget =
          s.id === instanceId
            ? updated.resources.budget.monthlyLimitCny
            : s.resources.budget.monthlyLimitCny;
        return sum + budget;
      }, 0);
      const budgetLimit = quotas.tokenBudgetMonthly ?? 0;
      if (budgetLimit > 0 && totalBudget > budgetLimit) {
        throw new AppError(
          `aggregate budget ${totalBudget} exceeds tenant limit ${budgetLimit}`,
          400,
          'AGGREGATE_BUDGET_EXCEEDED'
        );
      }
    }

    // v1.8:声明态(resources)变更 → bump specGeneration,标记 spec drift 供 reconciler 检测增量调和
    const specBumped = bumpSpecGeneration(updated);
    specBumped.version = await this.repo.save(specBumped);
    this.emitAudit('instance.resources.updated', specBumped, actor);
    return specBumped;
  }

  async resetResources(instanceId: string, actor = 'system'): Promise<Instance> {
    const inst = await this.get(instanceId);
    let quotas: TenantQuotas | undefined;
    if (this.tenantQuotaLookup) {
      quotas = await this.tenantQuotaLookup.getQuotas(inst.tenantId);
    }
    const updated = quotas ? resetResourceConfig(inst, quotas) : { ...touch(inst) };
    const specBumped = bumpSpecGeneration(updated);
    specBumped.version = await this.repo.save(specBumped);
    this.emitAudit('instance.resources.reset', specBumped, actor);
    return specBumped;
  }

  /* ---- quota helper ---- */

  /**
   * 创建实例前置校验:租户实例数不得超过 maxInstances。
   * - tenantQuotaLookup 未注入时跳过(向后兼容)
   * - maxInstances <= 0 视为不限制
   * - 已达上限抛 QUOTA_EXCEEDED(400)
   */
  private async assertWithinInstanceQuota(tenantId: string): Promise<void> {
    if (!this.tenantQuotaLookup) return;
    const quotas = await this.tenantQuotaLookup.getQuotas(tenantId);
    const limit = quotas.maxInstances;
    if (limit <= 0) return;
    const siblings = await this.repo.findAll(tenantId);
    if (siblings.length >= limit) {
      throw new AppError(
        `quota exceeded: maxInstances (current=${siblings.length}, limit=${limit})`,
        400,
        'QUOTA_EXCEEDED'
      );
    }
  }

  /* ---- audit helper ---- */

  private emitAudit(action: string, inst: Instance, actor: string): void {
    if (!this.audit) return;
    this.audit.log({
      action,
      instanceId: inst.id,
      tenantId: inst.tenantId,
      actor,
      detail: { state: inst.state },
      timestamp: nowIso(),
    });
  }
}
