import { describe, it, expect, vi } from 'vitest';
import { createPlatformMonitoringRoutes } from './monitoring.js';

function mockDeps() {
  return {
    instanceSvc: {
      list: vi.fn().mockResolvedValue([
        { id: 'i-1', state: 'running', tenantId: 'tn-1' },
        { id: 'i-2', state: 'stopped', tenantId: 'tn-2' },
      ]),
    },
    tenantSvc: {
      list: vi.fn().mockResolvedValue([
        { id: 'tn-1', name: 'Tenant A', status: 'active' },
        { id: 'tn-2', name: 'Tenant B', status: 'active' },
      ]),
    },
    analyticsSvc: {
      checkDbHealth: vi.fn().mockResolvedValue('healthy'),
    },
  };
}

describe('platform monitoring routes', () => {
  it('GET /overview returns system overview', async () => {
    const { instanceSvc, tenantSvc, analyticsSvc } = mockDeps();
    const app = createPlatformMonitoringRoutes(
      instanceSvc as never,
      tenantSvc as never,
      analyticsSvc as never
    );
    const res = await app.request('/overview');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalTenants).toBe(2);
    expect(body.activeTenants).toBe(2);
    expect(body.runningInstances).toBe(1);
    expect(body.healthLevel).toBe('healthy');
  });

  it('GET /resources returns resource usage', async () => {
    const { instanceSvc, tenantSvc, analyticsSvc } = mockDeps();
    const app = createPlatformMonitoringRoutes(
      instanceSvc as never,
      tenantSvc as never,
      analyticsSvc as never
    );
    const res = await app.request('/resources');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenants).toHaveLength(2);
    expect(body.tenants[0].tenantName).toBe('Tenant A');
  });

  it('GET /health returns healthy status', async () => {
    const { instanceSvc, tenantSvc, analyticsSvc } = mockDeps();
    const app = createPlatformMonitoringRoutes(
      instanceSvc as never,
      tenantSvc as never,
      analyticsSvc as never
    );
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.tenants).toHaveLength(2);
    expect(body.tenants[0].level).toBe('healthy');
  });

  it('GET /health returns degraded when no running instances', async () => {
    const { instanceSvc, tenantSvc, analyticsSvc } = mockDeps();
    instanceSvc.list.mockResolvedValue([{ id: 'i-1', state: 'stopped' }]);
    const app = createPlatformMonitoringRoutes(
      instanceSvc as never,
      tenantSvc as never,
      analyticsSvc as never
    );
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.status).toBe('degraded');
  });

  it('GET /health returns unhealthy when db is down', async () => {
    const { instanceSvc, tenantSvc, analyticsSvc } = mockDeps();
    analyticsSvc.checkDbHealth.mockResolvedValue('unhealthy');
    const app = createPlatformMonitoringRoutes(
      instanceSvc as never,
      tenantSvc as never,
      analyticsSvc as never
    );
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.status).toBe('unhealthy');
  });
});
