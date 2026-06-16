import { describe, it, expect, vi } from 'vitest';
import { TenantService, type ITenantRepository } from './tenant-service.js';
import { createTenant, TENANT_STATUS } from './domain/tenant.js';

function makeTenant(overrides: Record<string, unknown> = {}) {
  const base = createTenant({ name: '测试租户', slug: 'test-tenant' });
  return { ...base, ...overrides };
}

function makeRepo(tenants: ReturnType<typeof makeTenant>[] = []): ITenantRepository {
  const store = new Map(tenants.map((t) => [t.id, t]));
  const members = new Map<string, number>();
  return {
    listTenants: vi.fn(async () => Array.from(store.values())),
    getTenant: vi.fn(async (id: string) => store.get(id) || null),
    saveTenant: vi.fn(async (t) => {
      store.set(t.id, t);
    }),
    listInstances: vi.fn(async () => []),
    savePlatformUser: vi.fn(async () => {}),
    countTenantMembers: vi.fn(async (tenantId: string) => members.get(tenantId) || 0),
    deleteTenant: vi.fn(async (tenantId: string) => {
      store.delete(tenantId);
      members.delete(tenantId);
    }),
    _setMembers: (tenantId: string, count: number) => members.set(tenantId, count),
  };
}

describe('TenantService', () => {
  describe('list', () => {
    it('returns all tenants', async () => {
      const t = makeTenant();
      const svc = new TenantService(makeRepo([t]));
      const result = await svc.list();
      expect(result).toHaveLength(1);
    });

    it('filters by status', async () => {
      const a = makeTenant({ status: TENANT_STATUS.ACTIVE });
      const b = makeTenant({ status: TENANT_STATUS.SUSPENDED });
      const svc = new TenantService(makeRepo([a, b]));
      const result = await svc.list({ status: TENANT_STATUS.ACTIVE });
      expect(result).toHaveLength(1);
    });

    it('filters by search query', async () => {
      const a = makeTenant({ name: 'Alpha公司', slug: 'alpha' });
      const b = makeTenant({ name: 'Beta公司', slug: 'beta' });
      const svc = new TenantService(makeRepo([a, b]));
      const result = await svc.list({ q: 'alpha' });
      expect(result).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('returns tenant by id', async () => {
      const t = makeTenant();
      const svc = new TenantService(makeRepo([t]));
      const result = await svc.getById(t.id);
      expect(result.id).toBe(t.id);
    });

    it('throws 404 for unknown id', async () => {
      const svc = new TenantService(makeRepo());
      await expect(svc.getById('nope')).rejects.toThrow('tenant not found');
    });
  });

  describe('create', () => {
    it('creates tenant and saves', async () => {
      const repo = makeRepo();
      const svc = new TenantService(repo);
      const { tenant } = await svc.create({ name: '新租户', slug: 'new-tenant' });
      expect(tenant.id).toBeDefined();
      expect(tenant.name).toBe('新租户');
      expect(repo.saveTenant).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate slug', async () => {
      const existing = makeTenant({ slug: 'taken' });
      const svc = new TenantService(makeRepo([existing]));
      await expect(svc.create({ name: 'X', slug: 'taken' })).rejects.toThrow(
        'slug "taken" already exists'
      );
    });

    it('creates initial admin when provided', async () => {
      const repo = makeRepo();
      const svc = new TenantService(repo);
      const { adminCreated, initialCredentials } = await svc.create({
        name: 'T',
        slug: 'te',
        initialAdmin: { username: 'admin', password: 'pw123' },
      });
      expect(adminCreated).toBe(true);
      expect(initialCredentials).toEqual({ username: 'admin', password: 'pw123' });
      expect(repo.savePlatformUser).toHaveBeenCalledTimes(1);
      const savedUser = (repo.savePlatformUser as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedUser.username).toBe('admin');
      expect(savedUser.password).toMatch(/^bcrypt:/);
      expect(savedUser.role).toBe('tenant_admin');
      expect(savedUser.tenantId).toBeDefined();
    });

    it('auto-generates password when not provided', async () => {
      const repo = makeRepo();
      const svc = new TenantService(repo);
      const { initialCredentials } = await svc.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
      });
      expect(initialCredentials).not.toBeNull();
      // 无 contactName 时，回退到 slug + admin
      expect(initialCredentials!.username).toBe('test-tenantadmin');
      expect(initialCredentials!.password).toHaveLength(12);
    });

    it('uses contactName as default username', async () => {
      const repo = makeRepo();
      const svc = new TenantService(repo);
      const { initialCredentials } = await svc.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
        contactName: 'Alice',
      });
      expect(initialCredentials).not.toBeNull();
      expect(initialCredentials!.username).toBe('alice');
      expect(initialCredentials!.password).toHaveLength(12);
    });

    it('uses contact info for admin when initialAdmin is not provided', async () => {
      const repo = makeRepo();
      const svc = new TenantService(repo);
      await svc.create({
        name: 'T',
        slug: 'te',
        contactName: 'Alice',
        contactEmail: 'zhangsan@example.com',
      });
      const savedUser = (repo.savePlatformUser as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedUser.displayName).toBe('Alice');
      expect(savedUser.email).toBe('zhangsan@example.com');
    });
  });

  describe('update', () => {
    it('updates tenant fields', async () => {
      const t = makeTenant({ status: TENANT_STATUS.ACTIVE });
      const svc = new TenantService(makeRepo([t]));
      const result = await svc.update(t.id, { name: '更新名称' });
      expect(result.name).toBe('更新名称');
    });

    it('rejects update on archived tenant', async () => {
      const t = makeTenant({ status: TENANT_STATUS.ARCHIVED });
      const svc = new TenantService(makeRepo([t]));
      await expect(svc.update(t.id, { name: 'X' })).rejects.toThrow(
        'cannot update archived tenant'
      );
    });

    it('rejects duplicate slug on update', async () => {
      const a = makeTenant({ slug: 'a' });
      const b = makeTenant({ slug: 'b' });
      const svc = new TenantService(makeRepo([a, b]));
      await expect(svc.update(a.id, { slug: 'b' })).rejects.toThrow('slug "b" already exists');
    });
  });

  describe('lifecycle transitions', () => {
    it('suspends an active tenant', async () => {
      const t = makeTenant({ status: TENANT_STATUS.ACTIVE });
      const svc = new TenantService(makeRepo([t]));
      const result = await svc.suspend(t.id);
      expect(result.status).toBe(TENANT_STATUS.SUSPENDED);
    });

    it('activates a suspended tenant', async () => {
      const t = makeTenant({ status: TENANT_STATUS.SUSPENDED });
      const svc = new TenantService(makeRepo([t]));
      const result = await svc.activate(t.id);
      expect(result.status).toBe(TENANT_STATUS.ACTIVE);
    });

    it('archives a suspended tenant', async () => {
      const t = makeTenant({ status: TENANT_STATUS.SUSPENDED });
      const svc = new TenantService(makeRepo([t]));
      const result = await svc.archive(t.id);
      expect(result.status).toBe(TENANT_STATUS.ARCHIVED);
    });
  });

  describe('getUsage', () => {
    it('returns quota and instance count', async () => {
      const t = makeTenant();
      const repo = makeRepo([t]);
      (repo.listInstances as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'i1',
          name: 'A',
          state: 'running',
          resourceSource: 'tenant_default',
          budgetMonthlyLimit: 0,
          budgetUsed: 0,
          cpu: '500m',
          memory: '512Mi',
        },
        {
          id: 'i2',
          name: 'B',
          state: 'stopped',
          resourceSource: 'custom',
          budgetMonthlyLimit: 5000,
          budgetUsed: 1200,
          cpu: '1000m',
          memory: '1Gi',
        },
      ]);
      const svc = new TenantService(repo);
      const usage = await svc.getUsage(t.id);
      expect(usage.usage.instances.total).toBe(2);
      expect(usage.usage.instances.running).toBe(1);
      expect(usage.usage.instances.customConfigured).toBe(1);
      expect(usage.usage.budget.totalAllocated).toBe(5000);
      expect(usage.usage.budget.totalUsed).toBe(1200);
      expect(usage.usage.byInstance).toHaveLength(2);
    });
  });

  describe('knowledge provisioner hook', () => {
    it('calls provisionTenant on create when provisioner is set', async () => {
      const repo = makeRepo();
      const provisioner = {
        provisionTenant: vi.fn().mockResolvedValue(undefined),
        deprovisionTenant: vi.fn().mockResolvedValue(undefined),
      };
      const svc = new TenantService(repo, provisioner);
      const { tenant } = await svc.create({ name: 'WK租户', slug: 'wk-tenant' });
      expect(provisioner.provisionTenant).toHaveBeenCalledWith(tenant.id, 'wk-tenant', 'WK租户');
    });

    it('calls deprovisionTenant on archive', async () => {
      const t = makeTenant({ status: TENANT_STATUS.SUSPENDED });
      const provisioner = {
        provisionTenant: vi.fn(),
        deprovisionTenant: vi.fn().mockResolvedValue(undefined),
      };
      const svc = new TenantService(makeRepo([t]), provisioner);
      await svc.archive(t.id);
      expect(provisioner.deprovisionTenant).toHaveBeenCalledWith(t.id);
    });

    it('does not fail create if provisioner throws', async () => {
      const repo = makeRepo();
      const provisioner = {
        provisionTenant: vi.fn().mockRejectedValue(new Error('WeKnora unavailable')),
        deprovisionTenant: vi.fn(),
      };
      const svc = new TenantService(repo, provisioner);
      const { tenant } = await svc.create({ name: 'T', slug: 'slug-ok' });
      expect(tenant.id).toBeDefined();
    });
  });

  describe('checkQuota', () => {
    it('passes when under quota', async () => {
      const t = makeTenant({ status: TENANT_STATUS.ACTIVE });
      const svc = new TenantService(makeRepo([t]));
      const ok = await svc.checkQuota(t.id, 'instance');
      expect(ok).toBe(true);
    });

    it('throws for inactive tenant', async () => {
      const t = makeTenant({ status: TENANT_STATUS.SUSPENDED });
      const svc = new TenantService(makeRepo([t]));
      await expect(svc.checkQuota(t.id, 'instance')).rejects.toThrow('tenant is not active');
    });
  });

  describe('syncFromUpstream', () => {
    it('creates new tenants for unknown slugs', async () => {
      const repo = makeRepo();
      const svc = new TenantService(repo);
      const result = await svc.syncFromUpstream([
        { id: 1, name: 'Org A', slug: 'org-a', status: 'active' },
      ]);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(0);
      expect(repo.saveTenant).toHaveBeenCalledTimes(1);
    });

    it('updates existing tenant when name changes', async () => {
      const t = makeTenant({ name: 'Old Name', slug: 'org-a' });
      const repo = makeRepo([t]);
      const svc = new TenantService(repo);
      const result = await svc.syncFromUpstream([
        { id: 1, name: 'New Name', slug: 'org-a', status: 'active' },
      ]);
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });

    it('skips when name is unchanged', async () => {
      const t = makeTenant({ name: '不变', slug: 'no-change' });
      const repo = makeRepo([t]);
      const svc = new TenantService(repo);
      const result = await svc.syncFromUpstream([
        { id: 1, name: '不变', slug: 'no-change', status: 'active' },
      ]);
      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });
  });

  describe('delete', () => {
    it('deletes archived tenant without members', async () => {
      const t = makeTenant({ status: TENANT_STATUS.ARCHIVED });
      const repo = makeRepo([t]);
      const svc = new TenantService(repo);
      await svc.delete(t.id);
      expect(repo.deleteTenant).toHaveBeenCalledWith(t.id);
    });

    it('deletes suspended tenant without members', async () => {
      const t = makeTenant({ status: TENANT_STATUS.SUSPENDED });
      const repo = makeRepo([t]);
      const svc = new TenantService(repo);
      await svc.delete(t.id);
      expect(repo.deleteTenant).toHaveBeenCalledWith(t.id);
    });

    it('rejects delete for active tenant', async () => {
      const t = makeTenant({ status: TENANT_STATUS.ACTIVE });
      const repo = makeRepo([t]);
      const svc = new TenantService(repo);
      await expect(svc.delete(t.id)).rejects.toThrow('只有归档或停用的租户才能删除');
    });

    it('rejects delete when tenant has members', async () => {
      const t = makeTenant({ status: TENANT_STATUS.ARCHIVED });
      const repo = makeRepo([t]) as ReturnType<typeof makeRepo> & { _setMembers: (id: string, count: number) => void };
      repo._setMembers(t.id, 3);
      const svc = new TenantService(repo);
      const result = await svc.checkDeletable(t.id);
      expect(result.deletable).toBe(false);
      expect(result.reason).toContain('3 个成员');
    });

    it('allows delete when tenant has no members', async () => {
      const t = makeTenant({ status: TENANT_STATUS.ARCHIVED });
      const repo = makeRepo([t]);
      const svc = new TenantService(repo);
      const result = await svc.checkDeletable(t.id);
      expect(result.deletable).toBe(true);
    });
  });
});
