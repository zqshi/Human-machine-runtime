import { describe, it, expect, beforeEach } from 'vitest';
import { DepartmentService, type IDepartmentRepository } from './department-service.js';
import type { Department } from './domain/department.js';

function createMockRepo(): IDepartmentRepository & { store: Map<string, Department> } {
  const store = new Map<string, Department>();
  const repo: IDepartmentRepository = {
    async findAll(tenantId?: string) {
      const all = [...store.values()];
      return tenantId ? all.filter((d) => d.tenantId === tenantId) : all;
    },
    async findById(id) {
      return store.get(id);
    },
    async findByTenantAndSlug(tenantId, slug) {
      return [...store.values()].find((d) => d.tenantId === tenantId && d.slug === slug);
    },
    async findByTenantAndName(tenantId, name) {
      return [...store.values()].find((d) => d.tenantId === tenantId && d.name === name);
    },
    async save(dept) {
      store.set(dept.id, dept);
    },
    async delete(id) {
      store.delete(id);
    },
  };
  return Object.assign(repo, { store });
}

describe('DepartmentService', () => {
  let svc: DepartmentService;
  let repo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    repo = createMockRepo();
    svc = new DepartmentService(repo);
  });

  it('create persists and returns department with derived slug', async () => {
    const d = await svc.create({ tenantId: 't1', name: 'Finance' });
    expect(d.id).toMatch(/^dept_/);
    expect(d.slug).toBe('finance');
    expect(repo.store.size).toBe(1);
  });

  it('create rejects duplicate name within the same tenant', async () => {
    await svc.create({ tenantId: 't1', name: 'Finance' });
    await expect(svc.create({ tenantId: 't1', name: 'Finance' })).rejects.toMatchObject({
      code: 'DEPARTMENT_NAME_CONFLICT',
    });
  });

  it('create allows the same name across different tenants', async () => {
    await svc.create({ tenantId: 't1', name: 'Finance' });
    const d2 = await svc.create({ tenantId: 't2', name: 'Finance' });
    expect(d2.tenantId).toBe('t2');
    expect(repo.store.size).toBe(2);
  });

  it('get throws 404 when missing', async () => {
    await expect(svc.get('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('update changes name and description while keeping slug', async () => {
    const d = await svc.create({ tenantId: 't1', name: 'Finance' });
    const u = await svc.update(d.id, { name: 'Finance Dept', description: 'money' });
    expect(u.name).toBe('Finance Dept');
    expect(u.slug).toBe(d.slug);
    expect(u.description).toBe('money');
  });

  it('update rejects name conflict with a sibling department', async () => {
    await svc.create({ tenantId: 't1', name: 'Finance' });
    const d2 = await svc.create({ tenantId: 't1', name: 'HR' });
    await expect(svc.update(d2.id, { name: 'Finance' })).rejects.toMatchObject({
      code: 'DEPARTMENT_NAME_CONFLICT',
    });
  });

  it('remove deletes the department', async () => {
    const d = await svc.create({ tenantId: 't1', name: 'Finance' });
    await svc.remove(d.id);
    expect(repo.store.size).toBe(0);
  });

  it('getOrCreateByTenantAndName is idempotent', async () => {
    const d1 = await svc.getOrCreateByTenantAndName('t1', 'Finance');
    const d2 = await svc.getOrCreateByTenantAndName('t1', 'Finance');
    expect(d2.id).toBe(d1.id);
    expect(repo.store.size).toBe(1);
  });

  it('getOrCreateByTenantAndName creates when missing', async () => {
    const d = await svc.getOrCreateByTenantAndName('t1', 'HR');
    expect(d.name).toBe('HR');
    expect(repo.store.size).toBe(1);
  });
});
