import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { instances } from '../schema/instance.js';
import type { IInstanceRepository } from '../../contexts/tenant-instance/instance-service.js';
import {
  type Instance,
  type ResourceConfig,
  defaultResourceConfig,
} from '../../contexts/tenant-instance/domain/instance.js';
import { AppError } from '../../shared/utils.js';

export class InstanceRepository implements IInstanceRepository {
  constructor(private db: Database) {}

  async findAll(
    tenantId?: string,
    resourceSource?: string,
    limit?: number,
    offset?: number
  ): Promise<Instance[]> {
    // §7.2.1 第2条:limit/offset 下推 DB(动态查询),避免无限制全量返回
    let query = this.db.select().from(instances).$dynamic();
    if (tenantId) query = query.where(eq(instances.tenantId, tenantId));
    if (limit !== undefined) query = query.limit(limit);
    if (offset !== undefined) query = query.offset(offset);
    const rows = await query;
    let result = rows.map(toInstanceDomain);
    if (resourceSource === 'custom') {
      result = result.filter((r) => r.resources.source === 'custom');
    } else if (resourceSource === 'tenant_default') {
      result = result.filter((r) => r.resources.source !== 'custom');
    }
    return result;
  }

  async findById(id: string): Promise<Instance | undefined> {
    const [row] = await this.db.select().from(instances).where(eq(instances.id, id)).limit(1);
    return row ? toInstanceDomain(row) : undefined;
  }

  async save(instance: Instance): Promise<number> {
    const values = toInstanceRow(instance);

    // CAS: 乐观更新，仅当 version 匹配时才递增
    const updated = await this.db
      .update(instances)
      .set({ ...values, version: instance.version + 1 })
      .where(and(eq(instances.id, instance.id), eq(instances.version, instance.version)))
      .returning({ id: instances.id });

    if (updated.length > 0) {
      return instance.version + 1;
    }

    // 0 行：要么不存在(新建)，要么 version 冲突。用 onConflictDoNothing 区分两者
    const inserted = await this.db
      .insert(instances)
      .values({ ...values, version: 0 })
      .onConflictDoNothing({ target: instances.id })
      .returning({ id: instances.id });

    if (inserted.length > 0) {
      return 0;
    }
    // INSERT 也无行返回 → 主键已存在且 version 不匹配 → 并发冲突
    throw new AppError(
      'instance version conflict (concurrent modification)',
      409,
      'VERSION_CONFLICT'
    );
  }

  async findByFarmInstanceId(farmInstanceId: string): Promise<Instance | undefined> {
    const [row] = await this.db
      .select()
      .from(instances)
      .where(eq(instances.farmInstanceId, farmInstanceId))
      .limit(1);
    return row ? toInstanceDomain(row) : undefined;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(instances).where(eq(instances.id, id));
  }
}

function toInstanceDomain(row: typeof instances.$inferSelect): Instance {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    source: row.source,
    matrixRoomId: row.matrixRoomId ?? null,
    creator: row.creator ?? '',
    enterpriseUserId: row.enterpriseUserId ?? null,
    employeeNo: row.employeeNo ?? '',
    employeeId: row.employeeId ?? '',
    email: row.email ?? null,
    jobCode: row.jobCode ?? '',
    jobTitle: row.jobTitle ?? '',
    department: row.department ?? '',
    departmentId: row.departmentId ?? null,
    permissionTemplateId: row.permissionTemplateId ?? '',
    permissionTemplate: (row.permissionTemplate ?? null) as Record<string, unknown> | null,
    state: row.state as Instance['state'],
    farmInstanceId: row.farmInstanceId ?? null,
    farmPodName: row.farmPodName ?? null,
    farmNamespace: row.farmNamespace ?? null,
    runtime: (row.runtime ?? {}) as Record<string, unknown>,
    resources: parseResourceConfig(row.resources),
    policy: (row.policy ?? {}) as Record<string, unknown>,
    approvalPolicy: (row.approvalPolicy ?? {}) as Record<string, unknown>,
    requestId: row.requestId ?? null,
    version: row.version,
    desiredState: row.desiredState as Instance['desiredState'],
    specGeneration: row.specGeneration,
    agentDefinitionId: row.agentDefinitionId ?? null,
    agentGeneration: row.agentGeneration ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastError: row.lastError ?? null,
  };
}

function parseResourceConfig(raw: unknown): ResourceConfig {
  if (!raw || typeof raw !== 'object') return defaultResourceConfig();
  const obj = raw as Record<string, unknown>;
  if (!obj.source || !obj.compute) return defaultResourceConfig();
  return obj as unknown as ResourceConfig;
}

function toInstanceRow(inst: Instance) {
  return {
    id: inst.id,
    tenantId: inst.tenantId,
    name: inst.name,
    source: inst.source,
    matrixRoomId: inst.matrixRoomId,
    creator: inst.creator,
    enterpriseUserId: inst.enterpriseUserId,
    employeeNo: inst.employeeNo,
    employeeId: inst.employeeId,
    email: inst.email,
    jobCode: inst.jobCode,
    jobTitle: inst.jobTitle,
    department: inst.department,
    departmentId: inst.departmentId,
    permissionTemplateId: inst.permissionTemplateId,
    permissionTemplate: inst.permissionTemplate as Record<string, unknown> | undefined,
    resources: inst.resources as unknown as Record<string, string>,
    runtime: inst.runtime as Record<string, unknown>,
    policy: inst.policy as Record<string, unknown>,
    approvalPolicy: inst.approvalPolicy as Record<string, unknown>,
    farmInstanceId: inst.farmInstanceId ?? null,
    farmPodName: inst.farmPodName ?? null,
    farmNamespace: inst.farmNamespace ?? null,
    state: inst.state,
    desiredState: inst.desiredState,
    specGeneration: inst.specGeneration,
    requestId: inst.requestId ?? null,
    agentDefinitionId: inst.agentDefinitionId ?? null,
    agentGeneration: inst.agentGeneration ?? null,
    lastError: inst.lastError,
    createdAt: new Date(inst.createdAt),
    updatedAt: new Date(inst.updatedAt),
  };
}
