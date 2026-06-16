import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createControlMarketplaceRoutes } from './marketplace.js';

function mockUser() {
  return { username: 'admin1', tenantId: 'tn_test', roles: ['admin'] };
}

function withAuth(app: Hono) {
  const wrapper = new Hono();
  wrapper.use('*', async (c, next) => {
    c.set('user', mockUser());
    await next();
  });
  wrapper.route('/', app);
  return wrapper;
}

function mockMarketplaceService() {
  return {
    listSkillsForTenant: vi.fn().mockResolvedValue({ items: [{ id: 's-1' }], total: 1 }),
    getSkill: vi.fn().mockResolvedValue({ id: 's-1', name: 'Summarizer' }),
    getSkillStats: vi.fn().mockResolvedValue({ downloads: 100 }),
    downloadSkill: vi.fn().mockResolvedValue({ installed: true }),
    requestPublish: vi.fn().mockResolvedValue({ id: 'pub-1', status: 'pending' }),
    listPendingApprovals: vi.fn().mockResolvedValue([{ id: 'pub-1' }]),
    approvePublish: vi.fn().mockResolvedValue({ id: 'pub-1', status: 'approved' }),
    rejectPublish: vi.fn().mockResolvedValue({ id: 'pub-1', status: 'rejected' }),
    listAgents: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getModerationQueue: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
}

describe('control marketplace routes', () => {
  it('GET /skills returns skill list for tenant', async () => {
    const svc = mockMarketplaceService();
    const app = withAuth(createControlMarketplaceRoutes(svc as never));
    const res = await app.request('/skills?keyword=sum&page=1&pageSize=10');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(svc.listSkillsForTenant).toHaveBeenCalledWith('tn_test', {
      keyword: 'sum',
      page: 1,
      pageSize: 10,
    });
  });

  it('GET /skills/:id returns skill detail', async () => {
    const svc = mockMarketplaceService();
    const app = withAuth(createControlMarketplaceRoutes(svc as never));
    const res = await app.request('/skills/s-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe('Summarizer');
  });

  it('POST /skills/install validates body', async () => {
    const svc = mockMarketplaceService();
    const app = withAuth(createControlMarketplaceRoutes(svc as never));
    const res = await app.request('/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /skills/install downloads skill', async () => {
    const svc = mockMarketplaceService();
    const app = withAuth(createControlMarketplaceRoutes(svc as never));
    const res = await app.request('/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: 's-1' }),
    });
    expect(res.status).toBe(200);
    expect(svc.downloadSkill).toHaveBeenCalledWith('s-1', undefined, undefined);
  });

  it('GET /approvals returns pending approvals', async () => {
    const svc = mockMarketplaceService();
    const app = withAuth(createControlMarketplaceRoutes(svc as never));
    const res = await app.request('/approvals');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /approve/:id approves a publish request', async () => {
    const svc = mockMarketplaceService();
    const app = withAuth(createControlMarketplaceRoutes(svc as never));
    const res = await app.request('/approve/pub-1', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(svc.approvePublish).toHaveBeenCalledWith('pub-1', 'admin1', undefined);
  });

  it('POST /reject/:id rejects with reason', async () => {
    const svc = mockMarketplaceService();
    const app = withAuth(createControlMarketplaceRoutes(svc as never));
    const res = await app.request('/reject/pub-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'low quality' }),
    });
    expect(res.status).toBe(200);
    expect(svc.rejectPublish).toHaveBeenCalledWith('pub-1', 'admin1', 'low quality');
  });
});
