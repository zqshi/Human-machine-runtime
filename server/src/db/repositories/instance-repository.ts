import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { instances } from '../schema/instance.js';
import type { IInstanceRepository } from '../../contexts/tenant-instance/instance-service.js';
import {
  type Instance,
  type ResourceConfig,
  defaultResourceConfig,
} from '../../contexts/tenant-instance/domain/instance.js';

export class InstanceRepository implements IInstanceRepository {
  constructor(private db: Database) {}

  async findAll(tenantId?: string, resourceSource?: string): Promise<Instance[]> {
    const rows = tenantId
      ? await this.db.select().from(instances).where(eq(instances.tenantId, tenantId))
      : await this.db.select().from(instances);
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

  async save(instance: Instance): Promise<void> {
    const values = toInstanceRow(instance);
    await this.db
      .insert(instances)
      .values(values)
      .onConflictDoUpdate({ target: instances.id, set: values });
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
    requestId: inst.requestId ?? null,
    lastError: inst.lastError,
    createdAt: new Date(inst.createdAt),
    updatedAt: new Date(inst.updatedAt),
  };
}
