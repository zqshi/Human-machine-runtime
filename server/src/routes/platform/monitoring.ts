import { Hono } from 'hono';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { TenantService } from '../../contexts/tenant-management/tenant-service.js';
import type { AnalyticsService } from '../../contexts/analytics/analytics-service.js';

export function createPlatformMonitoringRoutes(
  instanceSvc: InstanceService,
  tenantSvc: TenantService,
  analyticsSvc: AnalyticsService
) {
  const app = new Hono();

  app.get('/overview', async (c) => {
    const tenants = await tenantSvc.list();
    const instances = await instanceSvc.list();
    const running = instances.filter((i) => i.state === 'running').length;
    const active = tenants.filter((t) => t.status === 'active').length;
    return c.json({
      totalTenants: tenants.length,
      activeTenants: active,
      runningInstances: running,
      healthLevel: running > 0 ? 'healthy' : 'degraded',
    });
  });

  app.get('/resources', async (c) => {
    const tenants = await tenantSvc.list();
    const instances = await instanceSvc.list();
    const tenantMap = new Map<string, { count: number; name: string }>();
    for (const t of tenants) {
      tenantMap.set(t.id, { count: 0, name: t.name || t.id });
    }
    for (const inst of instances) {
      const entry = tenantMap.get(inst.tenantId);
      if (entry) entry.count++;
    }
    const tenantResources = Array.from(tenantMap.entries()).map(([tid, info]) => ({
      tenantId: tid,
      tenantName: info.name,
      instanceCount: info.count,
      totalCpu: `${(info.count * 0.8).toFixed(1)} 核`,
      totalMemory: `${(info.count * 1.5).toFixed(1)} GB`,
      totalStorage: `${info.count * 20} GB`,
    }));
    return c.json({ tenants: tenantResources });
  });

  app.get('/health', async (c) => {
    const tenants = await tenantSvc.list();
    const instances = await instanceSvc.list();
    const running = instances.filter((i) => i.state === 'running').length;

    const dbStatus = await analyticsSvc.checkDbHealth();
    const overall = dbStatus === 'healthy' ? (running > 0 ? 'healthy' : 'degraded') : 'unhealthy';

    const tenantMap = new Map<string, { name: string; running: number; total: number }>();
    for (const t of tenants) {
      tenantMap.set(t.id, { name: t.name || t.id, running: 0, total: 0 });
    }
    for (const inst of instances) {
      const entry = tenantMap.get(inst.tenantId);
      if (entry) {
        entry.total++;
        if (inst.state === 'running') entry.running++;
      }
    }
    const tenantHealth = Array.from(tenantMap.entries()).map(([tid, info]) => ({
      tenantId: tid,
      tenantName: info.name,
      level: info.total === 0 ? 'unknown' : info.running > 0 ? 'healthy' : 'degraded',
      message: info.total === 0 ? '无实例' : `${info.running}/${info.total} 运行中`,
      checkedAt: new Date().toISOString(),
      services: [
        { name: 'Database', status: dbStatus, latency: 5 },
        { name: 'API', status: 'up', latency: 12 },
      ],
    }));

    return c.json({ status: overall, tenants: tenantHealth });
  });

  return app;
}
