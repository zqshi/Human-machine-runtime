import { describe, it, expect, vi } from 'vitest';
import { createAdminLogRoutes } from './logs.js';

function mockAuditSvc() {
  return {
    list: vi.fn().mockResolvedValue([
      { id: 'log-1', type: 'login', actor: 'admin', timestamp: '2026-05-01T00:00:00Z' },
    ]),
    export: vi.fn().mockResolvedValue({ body: 'id,type\nlog-1,login' }),
  };
}

describe('admin log routes', () => {
  it('GET / returns log list', async () => {
    const svc = mockAuditSvc();
    const app = createAdminLogRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(svc.list).toHaveBeenCalled();
  });

  it('GET / passes limit query param', async () => {
    const svc = mockAuditSvc();
    const app = createAdminLogRoutes(svc as never);
    await app.request('/?limit=50');
    expect(svc.list).toHaveBeenCalledWith(50, expect.any(Object));
  });

  it('GET /export/csv returns CSV', async () => {
    const svc = mockAuditSvc();
    const app = createAdminLogRoutes(svc as never);
    const res = await app.request('/export/csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
  });

  it('GET /export/json returns JSON', async () => {
    const svc = mockAuditSvc();
    const app = createAdminLogRoutes(svc as never);
    const res = await app.request('/export/json');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
