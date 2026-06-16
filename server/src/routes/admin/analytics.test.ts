import { describe, it, expect, vi } from 'vitest';
import { createAdminAnalyticsRoutes } from './analytics.js';
import { Hono } from 'hono';

function mockAnalyticsSvc() {
  return {
    getHealthMetrics: vi.fn().mockResolvedValue({
      score: 67,
      metrics: [
        { label: '运行实例', value: '2/3', status: 'ok' },
        { label: '系统健康', value: '67%', status: 'warn' },
        { label: 'AI 错误率', value: '2.3%', status: 'ok' },
        { label: 'AI 平均延迟', value: '1200ms', status: 'ok' },
      ],
    }),
    getAlerts: vi.fn().mockResolvedValue({ activeAlerts: 0, alerts: [] }),
    getLogStats: vi.fn().mockResolvedValue({
      totalRequests24h: 500,
      avgLatency: 1200,
      errorRate: 2.3,
      totalTokens: 80000,
    }),
    getDauTrend: vi.fn().mockResolvedValue({ days: [], values: [] }),
    getLatencyTrend: vi.fn().mockResolvedValue({ days: [], values: [] }),
    getAgentPerformance: vi.fn().mockResolvedValue({ score: 67, topAgents: [] }),
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

describe('admin analytics routes', () => {
  it('GET /health returns score and metrics', async () => {
    const svc = mockAnalyticsSvc();
    const inner = createAdminAnalyticsRoutes(svc as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.score).toBe(67);
    expect(body.metrics).toHaveLength(4);
    expect(body.metrics[0].label).toBe('运行实例');
    expect(body.metrics[0].value).toBe('2/3');
  });

  it('GET /health returns 100 when no instances', async () => {
    const svc = mockAnalyticsSvc();
    svc.getHealthMetrics.mockResolvedValue({ score: 100, metrics: [] });
    const inner = createAdminAnalyticsRoutes(svc as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.score).toBe(100);
  });

  it('GET /alerts returns alert list', async () => {
    const svc = mockAnalyticsSvc();
    const inner = createAdminAnalyticsRoutes(svc as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/alerts');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.activeAlerts).toBe(0);
    expect(body.alerts).toHaveLength(0);
  });

  it('GET /alerts includes failed instances and high error rate', async () => {
    const svc = mockAnalyticsSvc();
    svc.getAlerts.mockResolvedValue({
      activeAlerts: 2,
      alerts: [
        { level: 'error', message: '实例 Broken 运行失败: OOM', timestamp: '2026-05-01T00:00:00Z' },
        {
          level: 'warning',
          message: 'AI 调用错误率 15.0% 超过阈值',
          timestamp: '2026-05-01T00:00:00Z',
        },
      ],
    });
    const inner = createAdminAnalyticsRoutes(svc as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/alerts');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.activeAlerts).toBe(2);
    expect(body.alerts[0].level).toBe('error');
    expect(body.alerts[1].level).toBe('warning');
  });

  it('GET /log-stats returns trace statistics', async () => {
    const svc = mockAnalyticsSvc();
    const inner = createAdminAnalyticsRoutes(svc as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/log-stats');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalRequests24h).toBe(500);
    expect(body.avgLatency).toBe(1200);
    expect(body.errorRate).toBe(2.3);
    expect(body.totalTokens).toBe(80000);
  });

  it('GET /gateway-status returns gateway info', async () => {
    const svc = mockAnalyticsSvc();
    const litellm = {
      isConfigured: vi.fn().mockReturnValue(true),
      healthCheck: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    const clawhub = { isConfigured: vi.fn().mockReturnValue(false) };
    const inner = createAdminAnalyticsRoutes(svc as never, litellm as never, clawhub as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/gateway-status');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.gateways.litellm.status).toBe('ok');
    expect(body.gateways.clawhub.status).toBe('unconfigured');
  });

  it('GET /gateway-status handles litellm error', async () => {
    const svc = mockAnalyticsSvc();
    const litellm = {
      isConfigured: vi.fn().mockReturnValue(true),
      healthCheck: vi.fn().mockRejectedValue(new Error('connection refused')),
    };
    const clawhub = { isConfigured: vi.fn().mockReturnValue(false) };
    const inner = createAdminAnalyticsRoutes(svc as never, litellm as never, clawhub as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/gateway-status');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.gateways.litellm.status).toBe('error');
    expect(body.gateways.litellm.error).toBe('connection refused');
  });

  it('GET /gateway-status with no clients configured', async () => {
    const svc = mockAnalyticsSvc();
    const inner = createAdminAnalyticsRoutes(svc as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/gateway-status');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.gateways.litellm.status).toBe('unconfigured');
    expect(body.gateways.clawhub.status).toBe('unconfigured');
  });
});
