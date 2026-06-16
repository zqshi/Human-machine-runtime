import { describe, it, expect, vi } from 'vitest';
import { createAdminInstanceRoutes } from './instances.js';

function mockInstanceService(overrides: Record<string, unknown> = {}) {
  return {
    list: vi.fn().mockResolvedValue([
      { id: 'inst-1', name: 'Bot A', state: 'running' },
      { id: 'inst-2', name: 'Bot B', state: 'stopped' },
    ]),
    get: vi.fn().mockResolvedValue({ id: 'inst-1', name: 'Bot A', state: 'running' }),
    create: vi.fn().mockResolvedValue({ id: 'inst-3', name: 'New', state: 'stopped' }),
    update: vi.fn().mockResolvedValue({ id: 'inst-1', name: 'Updated', state: 'running' }),
    start: vi.fn().mockResolvedValue({ id: 'inst-1', state: 'running' }),
    stop: vi.fn().mockResolvedValue({ id: 'inst-1', state: 'stopped' }),
    ...overrides,
  } as never;
}

describe('admin instance routes', () => {
  it('GET / returns instance list', async () => {
    const app = createAdminInstanceRoutes(mockInstanceService());
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.instances).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('GET /:id returns single instance', async () => {
    const svc = mockInstanceService();
    const app = createAdminInstanceRoutes(svc);
    const res = await app.request('/inst-1');
    expect(res.status).toBe(200);
    expect(svc.get).toHaveBeenCalledWith('inst-1');
  });

  it('POST /:id/start calls service.start', async () => {
    const svc = mockInstanceService();
    const app = createAdminInstanceRoutes(svc);
    const res = await app.request('/inst-1/start', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('POST /:id/stop calls service.stop', async () => {
    const svc = mockInstanceService();
    const app = createAdminInstanceRoutes(svc);
    const res = await app.request('/inst-1/stop', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});
