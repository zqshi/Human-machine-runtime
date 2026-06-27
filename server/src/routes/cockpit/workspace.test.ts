import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createCockpitWorkspaceRoutes } from './workspace.js';

function mockUser() {
  return { username: 'testuser', tenantId: 'tn_test', roles: ['user'] };
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

function mockWorkspaceService() {
  return {
    listByOwner: vi.fn().mockResolvedValue([{ id: 'ws-1', name: 'My WS' }]),
    get: vi.fn().mockResolvedValue({
      id: 'ws-1',
      name: 'My WS',
      status: 'active',
      updatedAt: new Date().toISOString(),
    }),
    create: vi.fn().mockResolvedValue({ id: 'ws-2', name: 'New WS' }),
    createFromChat: vi.fn().mockResolvedValue({ id: 'ws-3', name: 'Chat WS' }),
    generateStream: vi.fn().mockResolvedValue(new Response('data: hello\n\n')),
    listConversations: vi.fn().mockResolvedValue([{ id: 'conv-1' }]),
    listApps: vi.fn().mockResolvedValue([{ id: 'app-1' }]),
    deployApp: vi.fn().mockResolvedValue({ status: 'deployed' }),
    installSkill: vi.fn().mockResolvedValue({ installed: true }),
    listAgents: vi.fn().mockResolvedValue([{ id: 'agent-1' }]),
  };
}

describe('cockpit workspace routes', () => {
  it('GET /workspace/list returns user workspaces', async () => {
    const svc = mockWorkspaceService();
    const app = withAuth(createCockpitWorkspaceRoutes(svc as never));
    const res = await app.request('/workspace/list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaces).toHaveLength(1);
    expect(svc.listByOwner).toHaveBeenCalledWith('testuser');
  });

  it('GET /workspace/:id returns workspace', async () => {
    const svc = mockWorkspaceService();
    const app = withAuth(createCockpitWorkspaceRoutes(svc as never));
    const res = await app.request('/workspace/ws-1');
    expect(res.status).toBe(200);
    expect(svc.get).toHaveBeenCalledWith('ws-1');
  });

  it('POST /workspace/create validates body and creates', async () => {
    const svc = mockWorkspaceService();
    const app = withAuth(createCockpitWorkspaceRoutes(svc as never));
    const res = await app.request('/workspace/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test WS' }),
    });
    expect(res.status).toBe(201);
    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test WS', ownerId: 'testuser' })
    );
  });

  it('POST /workspace/create returns 400 on invalid body', async () => {
    const svc = mockWorkspaceService();
    const app = withAuth(createCockpitWorkspaceRoutes(svc as never));
    const res = await app.request('/workspace/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /workspace/:id/conversations returns list', async () => {
    const svc = mockWorkspaceService();
    const app = withAuth(createCockpitWorkspaceRoutes(svc as never));
    const res = await app.request('/workspace/ws-1/conversations');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
  });

  it('GET /agents returns agent list', async () => {
    const svc = mockWorkspaceService();
    const app = withAuth(createCockpitWorkspaceRoutes(svc as never));
    const res = await app.request('/workspace/agents');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
  });
});
