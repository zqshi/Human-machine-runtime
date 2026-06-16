import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createQuotaRoutes } from './quotas.js';

function mockUser() {
  return { username: 'admin1', tenantId: 'tn_test', roles: ['admin'] };
}

function withAuth(app: Hono) {
  const wrapper = new Hono();
  wrapper.use('*', async (c, next) => {
    c.set('user', mockUser());
    await next();
  });
  wrapper.route('/', app);
  return wrapper;
}

function mockQuotaService() {
  return {
    getDashboard: vi.fn().mockResolvedValue({ totalUsage: 80, limit: 100 }),
    getAllocation: vi.fn().mockResolvedValue({ rows: [] }),
    getUsageHistory: vi.fn().mockResolvedValue({ history: [] }),
    listRules: vi.fn().mockResolvedValue([{ id: 1, resourceType: 'token_monthly' }]),
    createRule: vi.fn().mockResolvedValue({ id: 2, resourceType: 'token_daily' }),
    updateRule: vi.fn().mockResolvedValue({ id: 1, thresholdPct: 90 }),
    deleteRule: vi.fn().mockResolvedValue(undefined),
    listEvents: vi.fn().mockResolvedValue([]),
    acknowledgeEvent: vi.fn().mockResolvedValue({ id: 1, status: 'acknowledged' }),
  };
}

function mockTenantService() {
  return {
    getById: vi.fn().mockResolvedValue({
      id: 'tn_test',
      quotas: {
        instanceCpu: '500m',
        instanceMemory: '1Gi',
        instanceStorage: '5Gi',
        tokenBudgetMonthly: 100000,
        tokenBudgetDaily: 5000,
        maxConcurrentInstances: 5,
      },
    }),
    update: vi.fn().mockResolvedValue({
      id: 'tn_test',
      quotas: {
        instanceCpu: '1000m',
        instanceMemory: '2Gi',
        instanceStorage: '10Gi',
        tokenBudgetMonthly: 200000,
        tokenBudgetDaily: 10000,
        maxConcurrentInstances: 10,
      },
    }),
  };
}

describe('control quota routes', () => {
  it('GET /defaults returns tenant quotas', async () => {
    const qs = mockQuotaService();
    const ts = mockTenantService();
    const app = withAuth(createQuotaRoutes(qs as never, ts as never));
    const res = await app.request('/defaults');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.cpu).toBe('500m');
  });

  it('PUT /defaults updates tenant quotas', async () => {
    const qs = mockQuotaService();
    const ts = mockTenantService();
    const app = withAuth(createQuotaRoutes(qs as never, ts as never));
    const res = await app.request('/defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpu: '1000m', memory: '2Gi' }),
    });
    expect(res.status).toBe(200);
    expect(ts.update).toHaveBeenCalled();
  });

  it('GET /dashboard returns quota dashboard', async () => {
    const qs = mockQuotaService();
    const ts = mockTenantService();
    const app = withAuth(createQuotaRoutes(qs as never, ts as never));
    const res = await app.request('/dashboard');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totalUsage).toBe(80);
  });

  it('GET /alerts/rules returns rules list', async () => {
    const qs = mockQuotaService();
    const ts = mockTenantService();
    const app = withAuth(createQuotaRoutes(qs as never, ts as never));
    const res = await app.request('/alerts/rules');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /alerts/rules creates a rule', async () => {
    const qs = mockQuotaService();
    const ts = mockTenantService();
    const app = withAuth(createQuotaRoutes(qs as never, ts as never));
    const res = await app.request('/alerts/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceType: 'token_daily', thresholdPct: 80 }),
    });
    expect(res.status).toBe(201);
    expect(qs.createRule).toHaveBeenCalledWith(
      'tn_test',
      expect.objectContaining({ thresholdPct: 80 })
    );
  });

  it('DELETE /alerts/rules/:id deletes a rule', async () => {
    const qs = mockQuotaService();
    const ts = mockTenantService();
    const app = withAuth(createQuotaRoutes(qs as never, ts as never));
    const res = await app.request('/alerts/rules/1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(qs.deleteRule).toHaveBeenCalledWith(1);
  });

  it('POST /alerts/events/:id/ack acknowledges event', async () => {
    const qs = mockQuotaService();
    const ts = mockTenantService();
    const app = withAuth(createQuotaRoutes(qs as never, ts as never));
    const res = await app.request('/alerts/events/5/ack', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(qs.acknowledgeEvent).toHaveBeenCalledWith(5);
  });
});
