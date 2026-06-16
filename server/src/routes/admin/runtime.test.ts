import { describe, it, expect, vi } from 'vitest';
import { createAdminRuntimeRoutes } from './runtime.js';

function mockConfigSvc() {
  return {
    getSedimentationPolicy: vi.fn().mockResolvedValue({ mode: 'auto', minConfidence: 0.8 }),
    setSedimentationPolicy: vi.fn().mockResolvedValue(undefined),
    getOpenclawConfig: vi.fn().mockResolvedValue({ enabled: true }),
    setOpenclawConfig: vi.fn().mockResolvedValue(undefined),
    listOpenclawConfigSnapshots: vi.fn().mockResolvedValue([{ id: 'snap-1', createdAt: '2026-05-01' }]),
    restoreOpenclawConfigSnapshot: vi.fn().mockResolvedValue(true),
  };
}

describe('admin runtime routes', () => {
  it('GET /skill-sedimentation-policy returns policy', async () => {
    const svc = mockConfigSvc();
    const app = createAdminRuntimeRoutes(svc as never);
    const res = await app.request('/skill-sedimentation-policy');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('auto');
  });

  it('POST /skill-sedimentation-policy updates policy', async () => {
    const svc = mockConfigSvc();
    const app = createAdminRuntimeRoutes(svc as never);
    const res = await app.request('/skill-sedimentation-policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'manual' }),
    });
    expect(res.status).toBe(200);
    expect(svc.setSedimentationPolicy).toHaveBeenCalled();
  });

  it('GET /openclaw-config returns config', async () => {
    const svc = mockConfigSvc();
    const app = createAdminRuntimeRoutes(svc as never);
    const res = await app.request('/openclaw-config');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });

  it('GET /openclaw-config/snapshots returns snapshots', async () => {
    const svc = mockConfigSvc();
    const app = createAdminRuntimeRoutes(svc as never);
    const res = await app.request('/openclaw-config/snapshots');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots).toHaveLength(1);
  });

  it('POST /openclaw-config/snapshots/:id/restore returns 404 if not found', async () => {
    const svc = mockConfigSvc();
    svc.restoreOpenclawConfigSnapshot.mockResolvedValue(false);
    const app = createAdminRuntimeRoutes(svc as never);
    const res = await app.request('/openclaw-config/snapshots/snap-999/restore', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
