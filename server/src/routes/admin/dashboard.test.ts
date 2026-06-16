import { describe, it, expect, vi } from 'vitest';
import { createAdminDashboardRoutes } from './dashboard.js';
import { Hono } from 'hono';

function mockDeps() {
  return {
    tokenUsageService: {
      getUsageSummary: vi.fn().mockResolvedValue({ totalTokens: 1000, totalCost: 5.0 }),
      getLiteLLMSpend: vi.fn().mockResolvedValue({ totalSpend: 10 }),
    },
    aiGatewayRepo: {
      getTraceStats: vi.fn().mockResolvedValue({ totalCalls: 100, avgLatency: 200 }),
      listModels: vi.fn().mockResolvedValue([{ id: 'm-1', isActive: true }]),
    },
    instanceService: {
      list: vi.fn().mockResolvedValue([
        { id: 'i-1', state: 'running' },
        { id: 'i-2', state: 'stopped' },
      ]),
    },
    skillService: {
      listSharedAssets: vi.fn().mockResolvedValue([{ id: 's-1' }]),
    },
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

describe('admin dashboard routes', () => {
  it('GET /overview returns aggregated stats', async () => {
    const deps = mockDeps();
    const inner = createAdminDashboardRoutes(
      deps.tokenUsageService as never,
      deps.aiGatewayRepo as never,
      deps.instanceService as never,
      deps.skillService as never
    );
    const app = wrapWithAuth(inner);
    const res = await app.request('/overview');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.instanceCount).toBe(2);
    expect(body.data.runningInstances).toBe(1);
    expect(body.data.stoppedInstances).toBe(1);
    expect(body.data.skillCount).toBe(1);
  });
});
