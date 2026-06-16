import { Hono } from 'hono';
import type { AnalyticsService } from '../../contexts/analytics/analytics-service.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { ClawHubClient } from '../../contexts/gateway/clients/clawhub-client.js';
import type { ClawFarmClient } from '../../contexts/gateway/clients/claw-farm-client.js';
import type { XspaceClient } from '../../contexts/gateway/clients/xspace-client.js';
import type { PortalClient } from '../../contexts/gateway/clients/portal-client.js';

export interface AnalyticsRouteDeps {
  analyticsSvc: AnalyticsService;
  litellmClient?: LiteLLMClient;
  clawHubClient?: ClawHubClient;
  clawFarmClient?: ClawFarmClient;
  xspaceClient?: XspaceClient;
  portalClient?: PortalClient;
}

export function createAdminAnalyticsRoutes(
  analyticsSvc: AnalyticsService,
  litellmClient?: LiteLLMClient,
  clawHubClient?: ClawHubClient,
  clawFarmClient?: ClawFarmClient,
  xspaceClient?: XspaceClient,
  portalClient?: PortalClient
) {
  const app = new Hono();

  app.get('/health', async (c) => {
    return c.json(await analyticsSvc.getHealthMetrics());
  });

  app.get('/agent-performance', async (c) => {
    return c.json(await analyticsSvc.getAgentPerformance());
  });

  app.get('/alerts', async (c) => {
    return c.json(await analyticsSvc.getAlerts());
  });

  app.get('/log-stats', async (c) => {
    return c.json(await analyticsSvc.getLogStats());
  });

  app.get('/dau-trend', async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    return c.json(await analyticsSvc.getDauTrend(days));
  });

  app.get('/latency-trend', async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    return c.json(await analyticsSvc.getLatencyTrend(days));
  });

  app.get('/gateway-status', async (c) => {
    const checks = await Promise.allSettled([
      checkGateway('litellm', litellmClient),
      checkGateway('clawhub', clawHubClient),
      checkGateway('claw-farm', clawFarmClient),
      checkGateway('xspace', xspaceClient),
      checkGateway('portal', portalClient),
    ]);

    const names = ['litellm', 'clawhub', 'claw-farm', 'xspace', 'portal'];
    const gateways: Record<string, unknown> = {};
    checks.forEach((r, i) => {
      gateways[names[i]] =
        r.status === 'fulfilled' ? r.value : { status: 'error', error: String(r.reason) };
    });

    return c.json({ gateways });
  });

  return app;
}

async function checkGateway(
  _name: string,
  client?: { isConfigured(): boolean; healthCheck?(): Promise<unknown> }
): Promise<{ status: string; healthy?: boolean; error?: string }> {
  if (!client?.isConfigured()) return { status: 'unconfigured' };
  if (!client.healthCheck) return { status: 'ok' };
  try {
    const result = await client.healthCheck();
    const healthy = result !== false;
    return { status: healthy ? 'ok' : 'degraded', healthy };
  } catch (e) {
    return { status: 'error', healthy: false, error: (e as Error).message };
  }
}
