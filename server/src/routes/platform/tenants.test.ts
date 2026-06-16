import { describe, it, expect, vi } from 'vitest';
import { createTenantRoutes } from './tenants.js';

function mockTenantSvc() {
  return {
    list: vi.fn().mockResolvedValue([{ id: 'tn-1', name: 'Acme', slug: 'acme', status: 'active' }]),
    getById: vi.fn().mockResolvedValue({ id: 'tn-1', name: 'Acme' }),
    create: vi.fn().mockResolvedValue({ id: 'tn-2', name: 'Beta', slug: 'beta' }),
    update: vi.fn().mockResolvedValue({ id: 'tn-1', name: 'Acme Updated' }),
    suspend: vi.fn().mockResolvedValue({ id: 'tn-1', status: 'suspended' }),
    activate: vi.fn().mockResolvedValue({ id: 'tn-1', status: 'active' }),
    archive: vi.fn().mockResolvedValue({ id: 'tn-1', status: 'archived' }),
    getUsage: vi.fn().mockResolvedValue({ instances: 3, storage: 1024 }),
  };
}

describe('platform tenant routes', () => {
  it('GET / returns tenant list', async () => {
    const svc = mockTenantSvc();
    const app = createTenantRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenants).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('GET /:id returns tenant', async () => {
    const svc = mockTenantSvc();
    const app = createTenantRoutes(svc as never);
    const res = await app.request('/tn-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenant.name).toBe('Acme');
  });

  it('POST / creates tenant', async () => {
    const svc = mockTenantSvc();
    const app = createTenantRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Beta', slug: 'beta' }),
    });
    expect(res.status).toBe(201);
    expect(svc.create).toHaveBeenCalled();
  });

  it('POST / returns initial credentials when creating tenant', async () => {
    const svc = {
      ...mockTenantSvc(),
      create: vi.fn().mockResolvedValue({
        tenant: { id: 'tn-2', name: 'Beta', slug: 'beta' },
        adminCreated: true,
        initialCredentials: { username: 'betaadmin', password: 'abc123xyz' },
      }),
    };
    const app = createTenantRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Beta', slug: 'beta' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tenant).toBeDefined();
    expect(body.adminCreated).toBe(true);
    expect(body.initialCredentials).toEqual({ username: 'betaadmin', password: 'abc123xyz' });
  });

  it('POST / returns 400 for invalid body', async () => {
    const svc = mockTenantSvc();
    const app = createTenantRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /:id/suspend suspends tenant', async () => {
    const svc = mockTenantSvc();
    const app = createTenantRoutes(svc as never);
    const res = await app.request('/tn-1/suspend', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(svc.suspend).toHaveBeenCalledWith('tn-1');
  });

  it('GET /:id/usage returns usage data', async () => {
    const svc = mockTenantSvc();
    const app = createTenantRoutes(svc as never);
    const res = await app.request('/tn-1/usage');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usage.instances).toBe(3);
  });
});
