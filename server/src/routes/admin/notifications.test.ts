import { describe, it, expect, vi } from 'vitest';
import { createAdminNotificationRoutes } from './notifications.js';

function mockNotifSvc() {
  return {
    list: vi.fn().mockResolvedValue({
      items: [
        { id: 'n-1', title: 'Alert', read: false, escalated: false },
        { id: 'n-2', title: 'Info', read: true, escalated: false },
      ],
      summary: { unread: 1, total: 2 },
    }),
    getUnreadCount: vi.fn().mockResolvedValue({ unread: 1, total: 2 }),
    markRead: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
    snooze: vi.fn().mockResolvedValue(undefined),
    escalate: vi.fn().mockResolvedValue(undefined),
  };
}

describe('admin notification routes', () => {
  it('GET / returns items with summary', async () => {
    const svc = mockNotifSvc();
    const app = createAdminNotificationRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.summary.unread).toBe(1);
  });

  it('GET /count returns unread count', async () => {
    const svc = mockNotifSvc();
    const app = createAdminNotificationRoutes(svc as never);
    const res = await app.request('/count');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unread).toBe(1);
    expect(body.total).toBe(2);
  });

  it('POST /:id/read marks notification as read', async () => {
    const svc = mockNotifSvc();
    const app = createAdminNotificationRoutes(svc as never);
    const res = await app.request('/n-1/read', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(svc.markRead).toHaveBeenCalledWith('n-1');
  });

  it('POST /:id/dismiss removes notification', async () => {
    const svc = mockNotifSvc();
    const app = createAdminNotificationRoutes(svc as never);
    const res = await app.request('/n-1/dismiss', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(svc.dismiss).toHaveBeenCalledWith('n-1');
  });
});
