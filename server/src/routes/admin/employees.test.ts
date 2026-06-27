import { describe, it, expect, vi } from 'vitest';
import { createAdminEmployeeRoutes } from './employees.js';
import { Hono } from 'hono';

const fakeInstance = {
  id: 'inst-1',
  name: 'Alice',
  state: 'running',
  tenantId: 'default',
  source: 'manual',
  department: 'engineering',
  jobTitle: 'engineer',
  employeeNo: 'E001',
  employeeId: 'emp-1',
  email: 'alice@example.com',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
  runtime: {},
  policy: {},
  approvalPolicy: {},
};

function mockDeps() {
  return {
    svc: {
      list: vi.fn().mockResolvedValue([fakeInstance]),
      get: vi.fn().mockResolvedValue(fakeInstance),
      start: vi.fn().mockResolvedValue({ ...fakeInstance, state: 'running' }),
      stop: vi.fn().mockResolvedValue({ ...fakeInstance, state: 'stopped' }),
      rebuild: vi.fn().mockResolvedValue({ ...fakeInstance, state: 'rebuilding' }),
      updateProfile: vi.fn().mockResolvedValue(fakeInstance),
      updatePolicy: vi.fn().mockResolvedValue(fakeInstance),
      updateApprovalPolicy: vi.fn().mockResolvedValue(fakeInstance),
      create: vi.fn().mockResolvedValue(fakeInstance),
    },
    agentProfileRepo: {
      findByInstanceId: vi.fn().mockResolvedValue({ id: 'prof-1', displayName: 'Alice' }),
      upsert: vi.fn().mockResolvedValue({ id: 'prof-1', displayName: 'Alice' }),
    },
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

describe('admin employee routes', () => {
  it('GET / returns employee list', async () => {
    const deps = mockDeps();
    const inner = createAdminEmployeeRoutes(deps.svc as never, deps.agentProfileRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('inst-1');
    expect(body[0].name).toBe('Alice');
    expect(deps.svc.list).toHaveBeenCalledOnce();
  });

  it('POST / creates organization employee', async () => {
    const deps = mockDeps();
    const inner = createAdminEmployeeRoutes(deps.svc as never, deps.agentProfileRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Finance Assistant',
        scope: 'organization',
        department: 'finance',
        role: 'cockpit',
        channelId: 'ch-1',
        channelAppId: 'app-finance',
        riskLevel: 'L1',
        description: '处理财务任务',
      }),
    });

    expect(res.status).toBe(201);
    expect(deps.svc.create).toHaveBeenCalledWith({
      tenantId: 'default',
      name: 'Finance Assistant',
      source: 'organization',
      matrixRoomId: 'app-finance',
      creator: 'admin',
      enterpriseUserId: null,
      jobTitle: 'cockpit',
      department: 'finance',
    });
    expect(deps.agentProfileRepo.upsert).toHaveBeenCalledWith(
      'inst-1',
      'default',
      expect.objectContaining({
        displayName: 'Finance Assistant',
        knowMe: '处理财务任务',
        settings: {
          riskLevel: 'L1',
          description: '处理财务任务',
          channelBinding: { channelId: 'ch-1', appId: 'app-finance' },
          scope: 'organization',
        },
      })
    );
  });
  it('GET /:id returns single employee with profile', async () => {
    const deps = mockDeps();
    const inner = createAdminEmployeeRoutes(deps.svc as never, deps.agentProfileRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/inst-1');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe('inst-1');
    expect(body.profile).toEqual({ id: 'prof-1', displayName: 'Alice' });
    expect(body.portalProfile).toBeNull();
    expect(deps.svc.get).toHaveBeenCalledWith('inst-1');
    expect(deps.agentProfileRepo.findByInstanceId).toHaveBeenCalledWith('inst-1');
  });

  it('POST /:id/profile stores runtime, capability, evaluation and version settings', async () => {
    const deps = mockDeps();
    const inner = createAdminEmployeeRoutes(deps.svc as never, deps.agentProfileRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/inst-1/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Finance Assistant',
        runtimeProfile: { modelId: 'gpt-4o', systemPrompt: 'prompt' },
        channelBinding: { channelId: 'ch-1', appId: 'app-finance', name: '财务应用' },
        capabilities: ['tool-1'],
        linkedSkillIds: ['skill-1'],
        evaluationConfig: { suiteId: 'suite-1' },
        versions: [{ version: 'v0.1.0', status: 'draft' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(deps.svc.updateProfile).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ name: 'Finance Assistant' }),
      'admin'
    );
    expect(deps.agentProfileRepo.upsert).toHaveBeenCalledWith(
      'inst-1',
      'default',
      expect.objectContaining({
        displayName: 'Finance Assistant',
        settings: {
          runtimeProfile: { modelId: 'gpt-4o', systemPrompt: 'prompt' },
          channelBinding: { channelId: 'ch-1', appId: 'app-finance', name: '财务应用' },
          capabilities: ['tool-1'],
          linkedSkillIds: ['skill-1'],
          evaluationConfig: { suiteId: 'suite-1' },
          versions: [{ version: 'v0.1.0', status: 'draft' }],
        },
      })
    );
  });
  it('POST /:id/instance-action executes start', async () => {
    const deps = mockDeps();
    const inner = createAdminEmployeeRoutes(deps.svc as never, deps.agentProfileRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/inst-1/instance-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.state).toBe('running');
    expect(deps.svc.start).toHaveBeenCalledWith('inst-1');
  });

  it('POST /:id/instance-action executes stop', async () => {
    const deps = mockDeps();
    const inner = createAdminEmployeeRoutes(deps.svc as never, deps.agentProfileRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/inst-1/instance-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.state).toBe('stopped');
    expect(deps.svc.stop).toHaveBeenCalledWith('inst-1');
  });

  it('POST /:id/instance-action rejects invalid action', async () => {
    const deps = mockDeps();
    const inner = createAdminEmployeeRoutes(deps.svc as never, deps.agentProfileRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/inst-1/instance-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'explode' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('invalid action');
  });
});
