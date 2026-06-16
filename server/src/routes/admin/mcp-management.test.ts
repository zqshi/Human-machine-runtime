import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createAdminMcpRoutes } from './mcp-management.js';

function mockMcpService() {
  return {
    listMcpGroups: vi.fn().mockResolvedValue([{ id: 'g-1', name: 'default' }]),
    listTools: vi.fn().mockResolvedValue([{ id: 'tool-1', name: 'search' }]),
    enableGroup: vi.fn().mockResolvedValue(undefined),
    disableGroup: vi.fn().mockResolvedValue(undefined),
  };
}

function wrapWithAuth(inner: Hono) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 1,
      username: 'admin',
      tenantId: 'default',
      role: 'platform_admin',
      scope: 'platform',
      permissions: [],
    });
    await next();
  });
  app.route('/', inner);
  return app;
}

describe('admin mcp routes', () => {
  it('GET /groups returns groups', async () => {
    const svc = mockMcpService();
    const inner = createAdminMcpRoutes(svc as never);
    const app = wrapWithAuth(inner);
    const res = await app.request('/groups');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(svc.listMcpGroups).toHaveBeenCalledWith('default');
  });

  it('GET /groups/:id/tools returns tools', async () => {
    const svc = mockMcpService();
    const inner = createAdminMcpRoutes(svc as never);
    const app = wrapWithAuth(inner);
    const res = await app.request('/groups/g-1/tools');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /groups/:id/enable enables group', async () => {
    const svc = mockMcpService();
    const inner = createAdminMcpRoutes(svc as never);
    const app = wrapWithAuth(inner);
    const res = await app.request('/groups/g-1/enable', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(svc.enableGroup).toHaveBeenCalledWith('default', 'g-1');
  });

  it('POST /groups/:id/disable disables group', async () => {
    const svc = mockMcpService();
    const inner = createAdminMcpRoutes(svc as never);
    const app = wrapWithAuth(inner);
    const res = await app.request('/groups/g-1/disable', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(svc.disableGroup).toHaveBeenCalledWith('default', 'g-1');
  });
});
