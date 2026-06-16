import { Hono } from 'hono';
import type { AppContext } from '../app/bootstrap.js';

export function createHealthRoutes(ctx: AppContext) {
  const app = new Hono();

  app.get('/', (c) => {
    return c.json({
      status: 'ok',
      service: 'hmr-server',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (c) => {
    const checks: Record<string, string> = {};
    let ready = true;

    const dbStatus = await ctx.analyticsService.checkDbHealth();
    if (dbStatus === 'healthy') {
      checks.db = 'connected';
    } else {
      checks.db = 'disconnected';
      ready = false;
    }

    const gateways = ctx.gatewayHealth.getStatus();
    const configuredGateways = gateways.filter((g) => g.configured);
    const anyGatewayHealthy =
      configuredGateways.length === 0 || configuredGateways.some((g) => g.healthy);
    checks.gateways = anyGatewayHealthy ? 'ok' : 'degraded';

    return c.json({ status: ready ? 'ready' : 'not_ready', checks }, ready ? 200 : 503);
  });

  app.get('/detail', (c) => {
    const gateways = ctx.gatewayHealth.getStatus();
    return c.json({
      status: 'ok',
      service: 'hmr-server',
      timestamp: new Date().toISOString(),
      auth: { defaultProvider: ctx.authService.getRegistry().listRegistered() },
      gateways,
    });
  });

  return app;
}
