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

export interface IInstanceProvisioner {
  provision(instance: Instance): Promise<Record<string, unknown>>;
  teardown(instance: Instance): Promise<void>;
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

    let updated: Instance = { ...touch(inst), state: STATE.PROVISIONING, lastError: null };
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
    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.policy.updated', updated, actor);
    return updated;
  }

  async updateApprovalPolicy(
    instanceId: string,
    approvalPolicy: Record<string, unknown>,
    actor = 'system'
  ): Promise<Instance> {
    const inst = await this.get(instanceId);
    const updated: Instance = { ...touch(inst), approvalPolicy };
    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.approvalPolicy.updated', updated, actor);
    return updated;
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

    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.resources.updated', updated, actor);
    return updated;
  }

  async resetResources(instanceId: string, actor = 'system'): Promise<Instance> {
    const inst = await this.get(instanceId);
    let quotas: TenantQuotas | undefined;
    if (this.tenantQuotaLookup) {
      quotas = await this.tenantQuotaLookup.getQuotas(inst.tenantId);
    }
    const updated = quotas ? resetResourceConfig(inst, quotas) : { ...touch(inst) };
    updated.version = await this.repo.save(updated);
    this.emitAudit('instance.resources.reset', updated, actor);
    return updated;
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
