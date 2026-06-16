import { describe, it, expect, vi } from 'vitest';
import { createInstanceRoutes } from './instances.js';

function mockInstanceSvc() {
  return {
    list: vi.fn().mockResolvedValue([
      { id: 'i-1', state: 'running', tenantId: 'tn-1' },
    ]),
    get: vi.fn().mockResolvedValue({ id: 'i-1', state: 'running' }),
    createFromMatrix: vi.fn().mockResolvedValue({ id: 'i-2', state: 'created' }),
    start: vi.fn().mockResolvedValue({ id: 'i-1', state: 'running' }),
    stop: vi.fn().mockResolvedValue({ id: 'i-1', state: 'stopped' }),
    rebuild: vi.fn().mockResolvedValue({ id: 'i-1', state: 'running' }),
    remove: vi.fn().mockResolvedValue({ id: 'i-1', deleted: true }),
  };
}

describe('control instance routes', () => {
  it('GET / returns instance list', async () => {
    const svc = mockInstanceSvc();
    const app = createInstanceRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('GET /:id returns instance', async () => {
    const svc = mockInstanceSvc();
    const app = createInstanceRoutes(svc as never);
    const res = await app.request('/i-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.state).toBe('running');
  });

  it('POST / creates instance', async () => {
    const svc = mockInstanceSvc();
    const app = createInstanceRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tn-1',
        matrixUserId: '@bot:matrix.org',
        creator: 'admin',
      }),
    });
    expect(res.status).toBe(201);
    expect(svc.createFromMatrix).toHaveBeenCalled();
  });

  it('POST / returns 400 for missing required fields', async () => {
    const svc = mockInstanceSvc();
    const app = createInstanceRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tn-1' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /:id/start starts instance', async () => {
    const svc = mockInstanceSvc();
    const app = createInstanceRoutes(svc as never);
    const res = await app.request('/i-1/start', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(svc.start).toHaveBeenCalledWith('i-1');
  });

  it('DELETE /:id removes instance', async () => {
    const svc = mockInstanceSvc();
    const app = createInstanceRoutes(svc as never);
    const res = await app.request('/i-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(svc.remove).toHaveBeenCalledWith('i-1');
  });
});
