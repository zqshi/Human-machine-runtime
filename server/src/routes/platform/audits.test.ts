import { describe, it, expect, vi } from 'vitest';
import { createAuditRoutes } from './audits.js';

function mockAuditSvc() {
  return {
    queryPage: vi.fn().mockResolvedValue({
      rows: [{ id: 'a-1', type: 'login', actor: 'admin' }],
      total: 1,
      cursor: '0',
      nextCursor: null,
      hasMore: false,
    }),
    export: vi.fn().mockResolvedValue({ body: '[]', contentType: 'application/json' }),
  };
}

describe('platform audit routes', () => {
  it('GET / returns audit log page', async () => {
    const svc = mockAuditSvc();
    const app = createAuditRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('GET / passes filters', async () => {
    const svc = mockAuditSvc();
    const app = createAuditRoutes(svc as never);
    await app.request('/?type=login&actor=admin&limit=50');
    expect(svc.queryPage).toHaveBeenCalledWith(
      50,
      expect.objectContaining({ type: 'login', actor: 'admin' }),
      0
    );
  });

  it('GET /export returns exported data', async () => {
    const svc = mockAuditSvc();
    const app = createAuditRoutes(svc as never);
    const res = await app.request('/export?format=json');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
