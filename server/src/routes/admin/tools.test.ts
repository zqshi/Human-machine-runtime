import { describe, it, expect, vi } from 'vitest';
import { createAdminToolRoutes } from './tools.js';

function mockToolSvc() {
  return {
    listSources: vi.fn().mockResolvedValue([{ id: 'tsrc_1', name: 'My API' }]),
    getSource: vi.fn().mockResolvedValue({ id: 'tsrc_1', name: 'My API' }),
    createSource: vi.fn().mockResolvedValue({ id: 'tsrc_2', name: 'New' }),
    updateSource: vi.fn().mockResolvedValue({ id: 'tsrc_1', name: 'Updated' }),
    deleteSource: vi.fn().mockResolvedValue(undefined),
    syncSource: vi.fn().mockResolvedValue({
      success: true,
      toolsCreated: 5,
      toolsUpdated: 0,
      toolsRemoved: 0,
      errors: [],
    }),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    introspectSource: vi.fn().mockResolvedValue({
      tables: [{ name: 'users', columns: [{ name: 'id', type: 'int', pk: true }] }],
      errors: [],
    }),
    listDefinitions: vi.fn().mockResolvedValue([{ id: 'tdef_1', name: 'listUsers' }]),
    getDefinition: vi.fn().mockResolvedValue({ id: 'tdef_1', name: 'listUsers' }),
    updateDefinition: vi.fn().mockResolvedValue({ id: 'tdef_1', enabled: false }),
    executeTool: vi
      .fn()
      .mockResolvedValue({ success: true, data: { result: 'ok' }, durationMs: 42 }),
    listInstances: vi.fn().mockResolvedValue([]),
    bindTool: vi.fn().mockResolvedValue({ id: 'tinst_1' }),
    unbindTool: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      totalSources: 1,
      totalDefinitions: 5,
      enabledDefinitions: 4,
      totalCalls: 100,
      successRate: 95,
      avgDurationMs: 120,
    }),
    getCallLogs: vi.fn().mockResolvedValue([]),
    uploadSpec: vi
      .fn()
      .mockResolvedValue({ specVersion: '3.0.3', title: 'Pet API', toolCount: 10 }),
  };
}

/** Hono 路由需要 auth middleware 注入 user。直接用 mock context bypass。 */
function withUser(app: ReturnType<typeof createAdminToolRoutes>) {
  const { Hono } = require('hono');
  const wrapper = new Hono();
  wrapper.use('*', async (c: unknown, next: () => Promise<void>) => {
    (c as { set(k: string, v: unknown): void }).set('user', {
      username: 'admin',
      role: 'platform_admin',
      tenantId: 'tn_test',
    });
    await next();
  });
  wrapper.route('/', app);
  return wrapper;
}

describe('admin tool routes (v2)', () => {
  it('GET /sources returns source list', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/sources');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources).toHaveLength(1);
    expect(svc.listSources).toHaveBeenCalledWith('tn_test');
  });

  it('GET /sources/:id returns single source', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/sources/tsrc_1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('My API');
  });

  it('GET /sources/:id returns 404 when not found', async () => {
    const svc = mockToolSvc();
    svc.getSource.mockResolvedValue(null);
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/sources/tsrc_999');
    expect(res.status).toBe(404);
  });

  it('POST /sources creates source', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'openapi',
        name: 'My API',
        specUrl: 'https://example.com/spec.json',
      }),
    });
    expect(res.status).toBe(201);
    expect(svc.createSource).toHaveBeenCalled();
  });

  it('POST /sources/:id/sync triggers sync', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/sources/tsrc_1/sync', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.toolsCreated).toBe(5);
  });

  it('POST /sources/:id/introspect triggers introspectSource(探测不落库)', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/sources/tsrc_1/introspect', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toHaveLength(1);
    expect(body.tables[0].name).toBe('users');
    expect(svc.introspectSource).toHaveBeenCalledWith('tsrc_1');
  });

  it('GET /definitions returns tool definitions', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/definitions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.definitions).toHaveLength(1);
  });

  it('POST /definitions/:id/test executes tool', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/definitions/tdef_1/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: { limit: 10 } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET /stats returns statistics', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/stats');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalSources).toBe(1);
  });

  it('POST /upload-spec returns parse preview', async () => {
    const svc = mockToolSvc();
    const app = withUser(createAdminToolRoutes(svc as never));
    const res = await app.request('/upload-spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specContent: '{}' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.specVersion).toBe('3.0.3');
  });
});
