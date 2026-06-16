import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { AppError, nowIso } from '../../shared/utils.js';

/** Generate a human-friendly random password: alphanumeric, mixed case, length = n. */
function generatePassword(length = 12): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const base = randomUUID().replace(/-/g, '');
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[parseInt(base[i % base.length]!, 16) % chars.length];
  }
  return result;
}
import {
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  archiveTenant,
  TENANT_STATUS,
  type Tenant,
  type CreateTenantInput,
} from './domain/tenant.js';

export interface ITenantRepository {
  listTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | null>;
  saveTenant(tenant: Tenant): Promise<void>;
  listInstances(tenantId: string): Promise<TenantInstanceSummary[]>;
  savePlatformUser(user: Record<string, unknown>): Promise<void>;
  countTenantMembers(tenantId: string): Promise<number>;
  deleteTenant(tenantId: string): Promise<void>;
}

export interface TenantInstanceSummary {
  id: string;
  name: string;
  state: string;
  resourceSource: string;
  budgetMonthlyLimit: number;
  budgetUsed: number;
  cpu: string;
  memory: string;
}

export interface IKnowledgeProvisioner {
  provisionTenant(dcfTenantId: string, tenantSlug: string, tenantName: string): Promise<unknown>;
  deprovisionTenant(dcfTenantId: string): Promise<void>;
}

export class TenantService {
  private repo: ITenantRepository;
  private knowledgeProvisioner: IKnowledgeProvisioner | null;

  constructor(repo: ITenantRepository, knowledgeProvisioner?: IKnowledgeProvisioner) {
    this.repo = repo;
    this.knowledgeProvisioner = knowledgeProvisioner ?? null;
  }

  async list(filters?: { status?: string; plan?: string; q?: string }): Promise<Tenant[]> {
    let all = await this.repo.listTenants();
    if (!filters) return all;
    if (filters.status) all = all.filter((t) => t.status === filters.status);
    if (filters.plan) all = all.filter((t) => t.plan === filters.plan);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      all = all.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }
    return all;
  }

  async getById(tenantId: string): Promise<Tenant> {
    const tenant = await this.repo.getTenant(tenantId);
    if (!tenant) throw new AppError('tenant not found', 404, 'TENANT_NOT_FOUND');
    return tenant;
  }

  async create(
    input: CreateTenantInput & {
      initialAdmin?: { username?: string; password?: string; displayName?: string; email?: string };
    }
  ): Promise<{
    tenant: Tenant;
    adminCreated: boolean;
    initialCredentials: { username: string; password: string } | null;
  }> {
    const all = await this.repo.listTenants();
    if (all.find((t) => t.slug === input.slug))
      throw new AppError(`slug "${input.slug}" already exists`, 409, 'TENANT_SLUG_CONFLICT');
    const tenant = createTenant(input);
    await this.repo.saveTenant(tenant);

    // Resolve initial admin credentials: use provided values or auto-generate
    const contactName = input.contactName?.trim() || input.initialAdmin?.displayName?.trim();
    const username = input.initialAdmin?.username?.trim()
      || (contactName ? contactName.toLowerCase().replace(/\s+/g, '') : `${tenant.slug}admin`);
    const password = input.initialAdmin?.password
      || generatePassword(12);

    const hash = await bcrypt.hash(password, 10);
    await this.repo.savePlatformUser({
      username,
      displayName: (input.initialAdmin?.displayName || input.contactName || '').trim(),
      email: (input.initialAdmin?.email || input.contactEmail || '').trim(),
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: tenant.id,
      disabled: false,
      password: `bcrypt:${hash}`,
      source: 'dynamic',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    if (this.knowledgeProvisioner && tenant.features.knowledgeBase) {
      try {
        await this.knowledgeProvisioner.provisionTenant(tenant.id, tenant.slug, tenant.name);
      } catch (err) {
        console.warn(`[tenant] WeKnora provisioning failed for ${tenant.slug}:`, err);
      }
    }

    return {
      tenant,
      adminCreated: true,
      initialCredentials: { username, password },
    };
  }

  async update(tenantId: string, patch: Partial<CreateTenantInput>): Promise<Tenant> {
    const tenant = await this.getById(tenantId);
    if (tenant.status === TENANT_STATUS.ARCHIVED)
      throw new AppError('cannot update archived tenant', 400, 'TENANT_ARCHIVED');
    if (patch.slug && patch.slug !== tenant.slug) {
      const all = await this.repo.listTenants();
      if (all.find((t) => t.slug === patch.slug && t.id !== tenantId))
        throw new AppError(`slug "${patch.slug}" already exists`, 409, 'TENANT_SLUG_CONFLICT');
    }
    const updated = updateTenant(tenant, patch);
    await this.repo.saveTenant(updated);
    return updated;
  }

  async suspend(tenantId: string): Promise<Tenant> {
    const tenant = await this.getById(tenantId);
    const suspended = suspendTenant(tenant);
    await this.repo.saveTenant(suspended);
    return suspended;
  }

  async activate(tenantId: string): Promise<Tenant> {
    const tenant = await this.getById(tenantId);
    const activated = activateTenant(tenant);
    await this.repo.saveTenant(activated);
    return activated;
  }

  async archive(tenantId: string): Promise<Tenant> {
    const tenant = await this.getById(tenantId);
    const archived = archiveTenant(tenant);
    await this.repo.saveTenant(archived);
    if (this.knowledgeProvisioner) {
      try {
        await this.knowledgeProvisioner.deprovisionTenant(tenantId);
      } catch (err) {
        console.warn(`[tenant] WeKnora deprovision failed for ${tenantId}:`, err);
      }
    }
    return archived;
  }

  async getUsage(tenantId: string) {
    const tenant = await this.getById(tenantId);
    const instances = await this.repo.listInstances(tenantId);
    const customConfigured = instances.filter((i) => i.resourceSource === 'custom').length;
    const totalBudgetAllocated = instances.reduce((sum, i) => sum + (i.budgetMonthlyLimit || 0), 0);
    const totalBudgetUsed = instances.reduce((sum, i) => sum + (i.budgetUsed || 0), 0);

    return {
      tenantId,
      tenantName: tenant.name,
      quotas: tenant.quotas,
      usage: {
        instances: {
          total: instances.length,
          running: instances.filter((i) => i.state === 'running').length,
          customConfigured,
          default: instances.length - customConfigured,
        },
        budget: {
          totalAllocated: totalBudgetAllocated,
          totalUsed: totalBudgetUsed,
          remaining: totalBudgetAllocated - totalBudgetUsed,
        },
        byInstance: instances.map((i) => ({
          id: i.id,
          name: i.name,
          state: i.state,
          resourceSource: i.resourceSource,
          cpu: i.cpu,
          memory: i.memory,
          budgetLimit: i.budgetMonthlyLimit,
          budgetUsed: i.budgetUsed,
        })),
      },
    };
  }

  async syncFromUpstream(
    organizations: Array<{ id: number; name: string; slug: string; plan?: string; status: string }>
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const existing = await this.repo.listTenants();
    const slugMap = new Map(existing.map((t) => [t.slug, t]));
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const org of organizations) {
      const local = slugMap.get(org.slug);
      if (!local) {
        const tenant = createTenant({
          name: org.name,
          slug: org.slug,
          plan: org.plan || 'standard',
        });
        await this.repo.saveTenant(tenant);
        created++;
      } else if (local.name !== org.name) {
        const patched = updateTenant(local, { name: org.name });
        await this.repo.saveTenant(patched);
        updated++;
      } else {
        skipped++;
      }
    }

    return { created, updated, skipped };
  }

  async checkQuota(tenantId: string, resource: string): Promise<true> {
    const tenant = await this.getById(tenantId);
    if (tenant.status !== TENANT_STATUS.ACTIVE)
      throw new AppError('tenant is not active', 403, 'TENANT_NOT_ACTIVE');
    if (resource === 'instance') {
      const instances = await this.repo.listInstances(tenantId);
      if (instances.length >= tenant.quotas.maxInstances) {
        throw new AppError(
          `instance quota exceeded: ${instances.length}/${tenant.quotas.maxInstances}`,
          403,
          'TENANT_QUOTA_EXCEEDED'
        );
      }
    }
    return true;
  }

  async checkDeletable(tenantId: string): Promise<{ deletable: boolean; reason?: string }> {
    const tenant = await this.getById(tenantId);
    if (tenant.status !== TENANT_STATUS.ARCHIVED && tenant.status !== TENANT_STATUS.SUSPENDED) {
      return {
        deletable: false,
        reason: '只有归档或停用的租户才能删除',
      };
    }
    // Check member count
    const memberCount = await this.repo.countTenantMembers(tenantId);
    if (memberCount > 0) {
      return {
        deletable: false,
        reason: `该租户下有 ${memberCount} 个成员，请先移除所有成员`,
      };
    }
    return { deletable: true };
  }

  async delete(tenantId: string): Promise<void> {
    const check = await this.checkDeletable(tenantId);
    if (!check.deletable) {
      throw new AppError(check.reason!, 400, 'TENANT_NOT_DELETABLE');
    }
    await this.repo.deleteTenant(tenantId);
  }
}
