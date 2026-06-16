import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { tenants } from '../schema/tenant.js';
import { instances } from '../schema/instance.js';
import { users } from '../schema/identity.js';
import type {
  ITenantRepository,
  TenantInstanceSummary,
} from '../../contexts/tenant-management/tenant-service.js';
import type { Tenant } from '../../contexts/tenant-management/domain/tenant.js';

export class TenantRepository implements ITenantRepository {
  constructor(private db: Database) {}

  async listTenants(): Promise<Tenant[]> {
    const rows = await this.db.select().from(tenants);
    return rows.map(toTenantDomain);
  }

  async getTenant(id: string): Promise<Tenant | null> {
    const [row] = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return row ? toTenantDomain(row) : null;
  }

  async saveTenant(tenant: Tenant): Promise<void> {
    const values = toTenantRow(tenant);
    await this.db
      .insert(tenants)
      .values(values)
      .onConflictDoUpdate({ target: tenants.id, set: values });
  }

  async listInstances(tenantId: string): Promise<TenantInstanceSummary[]> {
    const rows = await this.db
      .select({
        id: instances.id,
        name: instances.name,
        state: instances.state,
        resources: instances.resources,
      })
      .from(instances)
      .where(eq(instances.tenantId, tenantId));

    return rows.map((r) => {
      const res =
        r.resources && typeof r.resources === 'object'
          ? (r.resources as Record<string, unknown>)
          : {};
      const compute = (res.compute || {}) as Record<string, unknown>;
      const budget = (res.budget || {}) as Record<string, unknown>;
      return {
        id: r.id,
        name: r.name,
        state: r.state,
        resourceSource: String(res.source || 'tenant_default'),
        budgetMonthlyLimit: Number(budget.monthlyLimitCny || 0),
        budgetUsed: 0,
        cpu: String(compute.cpu || '500m'),
        memory: String(compute.memory || '512Mi'),
      };
    });
  }

  async savePlatformUser(user: Record<string, unknown>): Promise<void> {
    await this.db.insert(users).values({
      username: String(user.username),
      passwordHash: String(user.password),
      role: String(user.role || 'user'),
      scope: String(user.scope || 'tenant'),
      tenantId: user.tenantId ? String(user.tenantId) : null,
      displayName: user.displayName ? String(user.displayName) : null,
      email: user.email ? String(user.email) : null,
      source: String(user.source || 'dynamic'),
    });
  }

  async countTenantMembers(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: users.id })
      .from(users)
      .where(eq(users.tenantId, tenantId));
    return result.length;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    await this.db.delete(tenants).where(eq(tenants.id, tenantId));
  }
}

function toTenantDomain(row: typeof tenants.$inferSelect): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan as Tenant['plan'],
    status: row.status as Tenant['status'],
    quotas: (row.quotas ?? {}) as unknown as Tenant['quotas'],
    features: (row.features ?? {}) as unknown as Tenant['features'],
    modelAccess: (row.modelAccess ?? {}) as unknown as Tenant['modelAccess'],
    contactEmail: row.contactEmail ?? null,
    contactName: row.contactName ?? null,
    contactPhone: row.contactPhone ?? null,
    industry: row.industry ?? 'other',
    companySize: row.companySize ?? 'small',
    description: row.description ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTenantRow(t: Tenant) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan,
    status: t.status,
    industry: t.industry,
    companySize: t.companySize,
    contactName: t.contactName,
    contactEmail: t.contactEmail,
    contactPhone: t.contactPhone,
    description: t.description,
    quotas: t.quotas as unknown as Record<string, number>,
    features: t.features as unknown as Record<string, boolean>,
    modelAccess: t.modelAccess as unknown as Record<string, unknown>,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
  };
}
