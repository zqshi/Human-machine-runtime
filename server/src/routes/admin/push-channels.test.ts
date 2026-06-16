import { describe, it, expect, vi } from 'vitest';
import { createAdminPushChannelRoutes } from './push-channels.js';

function mockPushSvc() {
  return {
    list: vi.fn().mockResolvedValue([{ id: 'ch-1', name: 'Slack' }]),
    create: vi.fn().mockResolvedValue({ id: 'ch-2', name: 'Teams' }),
    delete: vi.fn().mockResolvedValue(undefined),
    testWebhook: vi.fn().mockResolvedValue({ success: true }),
  };
}

describe('admin push-channel routes', () => {
  it('GET / returns channel list', async () => {
    const svc = mockPushSvc();
    const app = createAdminPushChannelRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toHaveLength(1);
  });

  it('POST / creates channel', async () => {
    const svc = mockPushSvc();
    const app = createAdminPushChannelRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Teams' }),
    });
    expect(res.status).toBe(201);
    expect(svc.create).toHaveBeenCalled();
  });

  it('POST /:id/delete removes channel', async () => {
    const svc = mockPushSvc();
    const app = createAdminPushChannelRoutes(svc as never);
    const res = await app.request('/ch-1/delete', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(svc.delete).toHaveBeenCalledWith('ch-1');
  });

  it('POST /:id/test runs webhook test', async () => {
    const svc = mockPushSvc();
    const app = createAdminPushChannelRoutes(svc as never);
    const res = await app.request('/ch-1/test', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
