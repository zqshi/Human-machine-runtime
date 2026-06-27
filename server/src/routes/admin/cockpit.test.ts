import { describe, it, expect, vi } from 'vitest';
import { createAdminCockpitRoutes } from './cockpit.js';

function mockAnalyticsSvc() {
  return {
    getCostSummary: vi.fn().mockResolvedValue({ totalCost: 120.5, currency: 'USD' }),
    getSlaMetrics: vi.fn().mockResolvedValue({ uptime: 99.9, avgResponse: 800 }),
    getMonitorAlerts: vi.fn().mockResolvedValue({ alerts: [] }),
    getPerformanceSummary: vi.fn().mockResolvedValue({ score: 85 }),
    getDauTrend: vi.fn().mockResolvedValue({ days: [], values: [] }),
    getMessagesTrend: vi.fn().mockResolvedValue({ days: [], values: [] }),
    getRetentionTrend: vi.fn().mockResolvedValue({ days: [], values: [] }),
    getDeptTokens: vi.fn().mockResolvedValue({ departments: [] }),
    getTopUsers: vi.fn().mockResolvedValue({ users: [] }),
    getLatencyPercentiles: vi.fn().mockResolvedValue({ p50: 200, p95: 800, p99: 1500 }),
    getErrorRateTrend: vi.fn().mockResolvedValue({ days: [], values: [] }),
    getTokensTrend: vi.fn().mockResolvedValue({ days: [], values: [] }),
  };
}

describe('admin cockpit routes', () => {
  it('GET /monitor/cost returns cost summary', async () => {
    const svc = mockAnalyticsSvc();
    const app = createAdminCockpitRoutes(svc as never);
    const res = await app.request('/monitor/cost');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCost).toBe(120.5);
  });

  it('GET /monitor/sla returns SLA metrics', async () => {
    const svc = mockAnalyticsSvc();
    const app = createAdminCockpitRoutes(svc as never);
    const res = await app.request('/monitor/sla');
    expect(res.status).toBe(200);
    expect(svc.getSlaMetrics).toHaveBeenCalled();
  });

  it('GET /monitor/alerts returns alerts', async () => {
    const svc = mockAnalyticsSvc();
    const app = createAdminCockpitRoutes(svc as never);
    const res = await app.request('/monitor/alerts');
    expect(res.status).toBe(200);
  });

  it('GET /statistics/dau passes days param', async () => {
    const svc = mockAnalyticsSvc();
    const app = createAdminCockpitRoutes(svc as never);
    await app.request('/statistics/dau?days=7');
    expect(svc.getDauTrend).toHaveBeenCalledWith(7, undefined);
  });

  it('GET /statistics/top-users passes limit param', async () => {
    const svc = mockAnalyticsSvc();
    const app = createAdminCockpitRoutes(svc as never);
    await app.request('/statistics/top-users?limit=5');
    expect(svc.getTopUsers).toHaveBeenCalledWith(5);
  });

  it('GET /statistics/tokens defaults to 14 days', async () => {
    const svc = mockAnalyticsSvc();
    const app = createAdminCockpitRoutes(svc as never);
    await app.request('/statistics/tokens');
    expect(svc.getTokensTrend).toHaveBeenCalledWith(14, undefined);
  });
});
