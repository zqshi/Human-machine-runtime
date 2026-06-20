import { Hono } from 'hono';
import type { Context } from 'hono';
import type { TokenUsageService } from '../../contexts/observability/token-usage-service.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { SkillService } from '../../contexts/shared-assets/skill-service.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { MarketplaceClient } from '../../contexts/gateway/clients/marketplace-client.js';
import type { ClusterInstanceClient } from '../../contexts/gateway/clients/cluster-instance-client.js';
import type { Principal } from '../../middleware/auth.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createAdminDashboardRoutes(
  tokenUsageService: TokenUsageService,
  aiGatewayRepo: AiGatewayRepository,
  instanceService: InstanceService,
  skillService: SkillService,
  litellmClient?: LiteLLMClient,
  marketplaceClient?: MarketplaceClient,
  clusterInstanceClient?: ClusterInstanceClient
) {
  const app = new Hono();

  app.get('/overview', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId ?? 'default';

    const [localInstances, usage, traceStats, skills] = await Promise.all([
      instanceService.list(tenantId),
      tokenUsageService.getUsageSummary(tenantId, '30d'),
      aiGatewayRepo.getTraceStats(),
      skillService.listSharedAssets(),
    ]);

    let instances = localInstances;
    if (!instances.length && clusterInstanceClient?.isConfigured()) {
      try {
        const res = await clusterInstanceClient.listInstances();
        instances = (res.items ?? []).map((r) => ({
          state: r.status,
        })) as typeof instances;
      } catch {
        /* unavailable */
      }
    }

    const running = instances.filter((i) => i.state === 'running').length;
    const models = await aiGatewayRepo.listModels();
    const activeModels = models.filter((m) => m.isActive).length;

    const [litellmSpend, litellmHealth, hubSkillCount] = await Promise.all([
      litellmClient?.isConfigured()
        ? litellmClient.getSpend({}).catch(() => null)
        : Promise.resolve(null),
      litellmClient?.isConfigured()
        ? litellmClient.healthCheck().catch(() => null)
        : Promise.resolve(null),
      marketplaceClient?.isConfigured()
        ? marketplaceClient
            .listSkills({ pageSize: 1 })
            .then((r) => (r as Record<string, unknown>)?.total ?? null)
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    return c.json({
      success: true,
      data: {
        instanceCount: instances.length,
        runningInstances: running,
        stoppedInstances: instances.filter((i) => i.state === 'stopped').length,
        failedInstances: instances.filter((i) => i.state === 'failed').length,
        tokenUsage: usage,
        traceStats,
        skillCount: skills.length,
        modelCount: models.length,
        activeModelCount: activeModels,
        litellmSpend,
        litellmStatus: litellmHealth,
        hubSkillCount,
      },
    });
  });

  app.get('/token-usage', async (c) => {
    const user = getUser(c);
    const tenantId = user.tenantId ?? 'default';
    const period = c.req.query('period') ?? '30d';
    const data = await tokenUsageService.getUsageSummary(tenantId, period);
    return c.json({ success: true, data });
  });

  app.get('/litellm-spend', async (c) => {
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');
    try {
      const data = await tokenUsageService.getLiteLLMSpend(startDate, endDate);
      return c.json({ success: true, data });
    } catch {
      return c.json({
        success: true,
        data: { totalSpend: 0, totalRequests: 0, entries: [], error: 'litellm unavailable' },
      });
    }
  });

  return app;
}
