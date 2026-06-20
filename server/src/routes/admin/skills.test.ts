import { describe, it, expect, vi } from 'vitest';
import { createAdminSkillRoutes } from './skills.js';
import { Hono } from 'hono';
import AdmZip from 'adm-zip';

const fakeSkill = {
  id: 'sk-1',
  name: 'Test Skill',
  description: 'A test skill',
  status: 'active',
  tags: ['test'],
  version: '1.0',
  publishedBy: 'admin',
  updatedAt: '2026-01-01',
};

function mockDeps() {
  return {
    skillSvc: {
      listSharedAssets: vi.fn().mockResolvedValue([fakeSkill]),
      getSharedAsset: vi.fn().mockResolvedValue(fakeSkill),
      report: vi.fn().mockResolvedValue({ id: 'sk-new', name: 'New Skill' }),
      updateSharedAsset: vi.fn().mockResolvedValue({ ...fakeSkill, name: 'Updated' }),
      deleteSharedAsset: vi.fn().mockResolvedValue(true),
      findBindingsByAsset: vi.fn().mockResolvedValue([{ tenantId: 'default' }]),
    },
    instanceSvc: {
      list: vi
        .fn()
        .mockResolvedValue([
          { id: 'inst-1', name: 'Alice', department: 'eng', jobTitle: 'dev', state: 'running' },
        ]),
    },
    opRepo: {
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
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

function buildApp(deps = mockDeps()) {
  const inner = createAdminSkillRoutes(
    deps.skillSvc as never,
    deps.instanceSvc as never,
    deps.opRepo as never
  );
  return { app: wrapWithAuth(inner), deps };
}

describe('admin skill routes', () => {
  it('GET / returns skill list', async () => {
    const { app, deps } = buildApp();

    const res = await app.request('/');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0].name).toBe('Test Skill');
    expect(body.skills[0].source).toBe('local');
    expect(body.total).toBe(1);
    expect(deps.skillSvc.listSharedAssets).toHaveBeenCalledOnce();
  });

  it('GET /:id returns single skill with bindings', async () => {
    const { app, deps } = buildApp();

    const res = await app.request('/sk-1');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('Test Skill');
    expect(body.source).toBe('shared');
    expect(body.linkedEmployeeIds).toEqual(['default']);
    expect(body.metadata.author).toBe('admin');
    expect(deps.skillSvc.getSharedAsset).toHaveBeenCalledWith('sk-1');
    expect(deps.skillSvc.findBindingsByAsset).toHaveBeenCalledWith('sk-1');
  });

  it('GET /:id returns 404 when skill not found', async () => {
    const deps = mockDeps();
    deps.skillSvc.getSharedAsset.mockResolvedValue(null);
    const { app } = buildApp(deps);

    const res = await app.request('/sk-missing');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('skill not found');
  });

  it('POST / creates a new skill', async () => {
    const { app, deps } = buildApp();

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Skill' }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBe('sk-new');
    expect(body.name).toBe('New Skill');
    expect(deps.skillSvc.report).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Skill', assetType: 'skill' })
    );
  });

  it('POST / rejects missing name', async () => {
    const { app } = buildApp();

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('invalid request');
  });

  it('DELETE /:id deletes a skill', async () => {
    const { app, deps } = buildApp();

    const res = await app.request('/sk-1', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(deps.skillSvc.deleteSharedAsset).toHaveBeenCalledWith('sk-1');
  });

  it('GET /employees returns employee list for skills', async () => {
    const { app, deps } = buildApp();

    const res = await app.request('/employees');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('inst-1');
    expect(deps.instanceSvc.list).toHaveBeenCalledOnce();
  });

  /* ──── GET /:id/file ──── */

  it('GET /:id/file returns 400 when filename is missing', async () => {
    const deps = mockDeps();
    const marketplace = { isConfigured: vi.fn().mockReturnValue(true), baseUrl: 'http://hub' };
    const inner = createAdminSkillRoutes(
      deps.skillSvc as never,
      deps.instanceSvc as never,
      deps.opRepo as never,
      marketplace as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/sk-1/file');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('filename query parameter is required');
  });

  it('GET /:id/file returns 503 when marketplace backend not configured', async () => {
    const { app } = buildApp();

    const res = await app.request('/sk-1/file?filename=index.ts');
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.error).toBe('marketplace backend not configured');
  });

  it('GET /:id/file returns file content from zip', async () => {
    const deps = mockDeps();
    const zip = new AdmZip();
    zip.addFile('index.ts', Buffer.from('console.log("hello")'));
    const zipBuffer = zip.toBuffer();

    const marketplace = { isConfigured: vi.fn().mockReturnValue(true), baseUrl: 'http://hub' };
    const inner = createAdminSkillRoutes(
      deps.skillSvc as never,
      deps.instanceSvc as never,
      deps.opRepo as never,
      marketplace as never
    );
    const app = wrapWithAuth(inner);

    const mockFetch = vi.fn().mockResolvedValue(new Response(zipBuffer, { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    try {
      const res = await app.request('/sk-1/file?filename=index.ts');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.filename).toBe('index.ts');
      expect(body.content).toBe('console.log("hello")');
      expect(body.size).toBe(20);
      expect(mockFetch).toHaveBeenCalledWith('http://hub/api/v1/download?slug=sk-1');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('GET /:id/file returns 404 when upstream returns non-ok', async () => {
    const deps = mockDeps();
    const marketplace = { isConfigured: vi.fn().mockReturnValue(true), baseUrl: 'http://hub' };
    const inner = createAdminSkillRoutes(
      deps.skillSvc as never,
      deps.instanceSvc as never,
      deps.opRepo as never,
      marketplace as never
    );
    const app = wrapWithAuth(inner);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    try {
      const res = await app.request('/sk-1/file?filename=index.ts');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('skill package not found upstream');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('GET /:id/file returns 404 when file not in zip', async () => {
    const deps = mockDeps();
    const zip = new AdmZip();
    zip.addFile('other.ts', Buffer.from('nope'));
    const zipBuffer = zip.toBuffer();

    const marketplace = { isConfigured: vi.fn().mockReturnValue(true), baseUrl: 'http://hub' };
    const inner = createAdminSkillRoutes(
      deps.skillSvc as never,
      deps.instanceSvc as never,
      deps.opRepo as never,
      marketplace as never
    );
    const app = wrapWithAuth(inner);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(zipBuffer, { status: 200 })));

    try {
      const res = await app.request('/sk-1/file?filename=index.ts');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('file not found in skill package');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
