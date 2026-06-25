import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { OperationalRepository } from '../../db/repositories/operational-repository.js';
import type { ConfigRepository } from '../../db/repositories/config-repository.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { LlmKeySyncService } from '../../contexts/gateway/llm-key-sync-service.js';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { Instance } from '../../contexts/tenant-instance/domain/instance.js';
import type { Principal } from '../../middleware/auth.js';
import { newId } from '../../shared/utils.js';
import { parseBody, badRequest } from '../../shared/validation.js';
import { logger } from '../../app/logger.js';
import { registerRiskRuleRoutes } from './ai-gateway/risk-rule-routes.js';

const createModelSchema = z.object({
  displayName: z.string().min(1).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  providerType: z.string().optional(),
  provider: z.string().optional(),
  protocolType: z.string().optional(),
  protocol: z.string().optional(),
  baseUrl: z.string().optional(),
  endpoint: z.string().optional(),
  providerModelName: z.string().optional(),
  modelName: z.string().optional(),
  apiKey: z.string().optional(),
  apiKeySecretRef: z.string().optional(),
  isSecure: z.boolean().optional(),
  isActive: z.boolean().optional(),
  inputPrice: z.number().optional(),
  outputPrice: z.number().optional(),
  cacheReadCost: z.number().optional(),
  cacheCreationCost: z.number().optional(),
  currency: z.string().optional(),
  maxTokens: z.number().int().optional(),
  timeout: z.number().int().optional(),
  streamTimeout: z.number().int().optional(),
  rateLimitPerMin: z.number().int().optional(),
});

const setModelGrantsSchema = z.object({
  instanceIds: z.array(z.string().min(1)).max(10000),
});

/** AI Gateway 全局配置 zod 校验：provider 字符串 + timeout 正整数（秒） */
const gatewayConfigSchema = z.object({
  provider: z.string().min(1),
  timeout: z.number().int().positive(),
});

/** AI Gateway 配置在 system_configs 表中的 key */
const GATEWAY_CONFIG_KEY = 'ai_gateway.config';

/** 内存默认值：system_configs 无记录时返回，保证前端首次访问有合理默认 */
const DEFAULT_GATEWAY_CONFIG = { provider: 'multi', timeout: 30 };

export function createAdminAiGatewayRoutes(
  repo: AiGatewayRepository,
  opRepo: OperationalRepository,
  litellmClient?: LiteLLMClient,
  instanceService?: InstanceService,
  keySyncService?: LlmKeySyncService,
  configRepo?: ConfigRepository
) {
  const app = new Hono();

  /** 将 Instance 实体映射为授权 UI 所需的精简结构 */
  function toGrantInstance(inst: Instance) {
    return {
      id: inst.id,
      name: inst.name,
      tenantId: inst.tenantId,
      departmentId: inst.departmentId,
      department: inst.department || null,
      ownerName: inst.jobTitle || inst.enterpriseUserId || null,
      state: inst.state,
    };
  }

  function getCallerUsername(c: Context): string {
    return (c.get('user') as Principal | undefined)?.username || 'system';
  }

  /* ──── Models ──── */

  app.get('/models', async (c) => {
    const models = await repo.listModels();

    let remoteModels: unknown = null;
    if (litellmClient?.isConfigured()) {
      try {
        remoteModels = await litellmClient.listModels();
      } catch (err) {
        logger.warn({ err }, 'litellm model list unavailable');
      }
    }

    return c.json({ models, rows: models, remote: remoteModels });
  });

  app.get('/litellm-health', async (c) => {
    if (!litellmClient?.isConfigured()) {
      return c.json({ status: 'unconfigured' });
    }
    try {
      const health = await litellmClient.healthCheck();
      return c.json({ status: 'ok', detail: health });
    } catch (e) {
      return c.json({ status: 'error', error: (e as Error).message });
    }
  });

  app.get('/providers', async (c) => {
    const builtinProviders = [
      { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com', protocolType: 'anthropic' },
      { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', protocolType: 'openai' },
      { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', protocolType: 'openai' },
      { id: 'zhipu', name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', protocolType: 'openai' },
      {
        id: 'qwen',
        name: '通义千问',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        protocolType: 'openai',
      },
      {
        id: 'google',
        name: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        protocolType: 'google',
      },
      { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', protocolType: 'openai' },
      { id: 'litellm', name: 'LiteLLM Proxy', baseUrl: 'http://localhost:4000', protocolType: 'openai' },
    ];
    return c.json({ providers: builtinProviders });
  });

  app.post('/models', async (c) => {
    const parsed = await parseBody(c, createModelSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const body = parsed.data;
    const model = await repo.createModel({
      displayName: body.displayName || body.name || '未命名模型',
      description: body.description,
      providerType: body.providerType || body.provider || 'openai',
      protocolType: body.protocolType || body.protocol || 'openai',
      baseUrl: body.baseUrl || body.endpoint || '',
      providerModelName: body.providerModelName || body.modelName,
      modelName: body.modelName,
      apiKey: body.apiKey,
      apiKeySecretRef: body.apiKeySecretRef,
      isSecure: body.isSecure ?? false,
      isActive: body.isActive ?? true,
      inputPrice: body.inputPrice,
      outputPrice: body.outputPrice,
      cacheReadCost: body.cacheReadCost,
      cacheCreationCost: body.cacheCreationCost,
      currency: body.currency,
      maxTokens: body.maxTokens,
      timeout: body.timeout,
      streamTimeout: body.streamTimeout,
      rateLimitPerMin: body.rateLimitPerMin,
    });
    return c.json(model, 201);
  });

  app.put('/models/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const parsed = await parseBody(c, createModelSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const model = await repo.updateModel(id, parsed.data);
    if (!model) return c.json({ error: 'model not found' }, 404);
    return c.json(model);
  });

  app.delete('/models/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const ok = await repo.deleteModel(id);
    return c.json({ success: ok });
  });

  app.post('/models/:id/toggle', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const model = await repo.toggleModel(id);
    if (!model) return c.json({ error: 'model not found' }, 404);
    return c.json({ success: true });
  });

  app.post('/models/:id/health-check', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const model = await repo.getModel(id);
    if (!model) return c.json({ error: 'model not found' }, 404);

    if (!model.baseUrl) {
      await repo.updateModel(id, { healthStatus: 'unconfigured' });
      return c.json({ status: 'unconfigured', message: '模型未配置 baseUrl' });
    }

    const startMs = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(model.baseUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - startMs;
      const status = resp.ok ? 'healthy' : 'degraded';
      await repo.updateModel(id, { healthStatus: status, lastHealthCheckAt: new Date() });
      return c.json({
        status,
        httpStatus: resp.status,
        latencyMs,
        checkedAt: new Date().toISOString(),
      });
    } catch (e) {
      await repo.updateModel(id, { healthStatus: 'unreachable', lastHealthCheckAt: new Date() });
      return c.json({
        status: 'unreachable',
        error: (e as Error).message,
        checkedAt: new Date().toISOString(),
      });
    }
  });

  /* ──── Model Grants（instance × model 白名单） ──── */

  app.get('/models/grants-count', async (c) => {
    const counts = await repo.countGrantsByModel();
    const map: Record<string, number> = {};
    for (const it of counts) map[String(it.modelId)] = it.count;
    return c.json({ counts: map });
  });

  app.get('/models/instances-for-grant', async (c) => {
    if (!instanceService) return c.json({ instances: [] });
    const tenantId = c.req.query('tenantId') || undefined;
    const instances = await instanceService.list(tenantId);
    return c.json({ instances: instances.map(toGrantInstance) });
  });

  app.get('/models/:id/grants', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const model = await repo.getModel(id);
    if (!model) return c.json({ error: 'model not found' }, 404);

    const [grants, instances] = await Promise.all([
      repo.listGrantsByModel(id),
      instanceService ? instanceService.list() : Promise.resolve([]),
    ]);
    return c.json({
      grants,
      instances: instances.map(toGrantInstance),
    });
  });

  app.put('/models/:id/grants', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const parsed = await parseBody(c, setModelGrantsSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const body = parsed.data;

    const model = await repo.getModel(id);
    if (!model) return c.json({ error: 'model not found' }, 404);

    // 授权写回需要 tenantId：优先从 query，否则从首个 instance 反查
    let tenantId = c.req.query('tenantId') || '';
    if (!tenantId && instanceService) {
      const all = await instanceService.list();
      const hit = all.find((i) => body.instanceIds.includes(i.id));
      if (hit) tenantId = hit.tenantId;
    }
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);

    const actor = getCallerUsername(c);
    const grants = await repo.setModelGrants(id, body.instanceIds, tenantId, actor);

    // 触发受影响 instance 的 LiteLLM key 同步（异步，不阻断响应）
    if (keySyncService) {
      keySyncService
        .syncInstances(body.instanceIds, tenantId)
        .catch((err) =>
          logger.warn({ err }, '[ai-gateway] key sync after grants update failed')
        );
    }

    return c.json({ success: true, grants });
  });

  /* ──── Key Sync（LiteLLM virtual key 同步） ──── */

  app.get('/key-sync/status', async (c) => {
    const keys = await repo.listInstanceKeys();
    return c.json({
      total: keys.length,
      synced: keys.filter((k) => k.syncStatus === 'synced').length,
      failed: keys.filter((k) => k.syncStatus === 'failed').length,
      keys: keys.map((k) => ({
        instanceId: k.instanceId,
        allowedModels: k.allowedModels,
        syncStatus: k.syncStatus,
        lastError: k.lastError,
        syncedAt: k.syncedAt,
      })),
    });
  });

  app.post('/key-sync/instance/:instanceId', async (c) => {
    if (!keySyncService) return c.json({ error: 'key sync disabled' }, 400);
    const instanceId = c.req.param('instanceId');
    const tenantId = c.req.query('tenantId') || '';
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const result = await keySyncService.syncInstance(instanceId, tenantId);
    return c.json(result);
  });

  app.post('/key-sync/all', async (c) => {
    if (!keySyncService || !instanceService) return c.json({ error: 'key sync disabled' }, 400);
    const instances = await instanceService.list();
    const results = await Promise.all(
      instances.map((i) => keySyncService.syncInstance(i.id, i.tenantId))
    );
    const summary = {
      total: results.length,
      synced: results.filter((r) => r.status === 'synced').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
    };
    return c.json({ summary, results });
  });

  /* ──── Failover Chains ──── */

  app.get('/failover-chains', async (c) => {
    const rows = await opRepo.list('ai_failover_chain');
    return c.json({ rows });
  });

  app.post('/failover-chains', async (c) => {
    const body = await c.req.json();
    const id = body.id || newId('fc');
    const chain = { id, ...body, updatedAt: new Date().toISOString() };
    await opRepo.upsert('ai_failover_chain', id, chain);
    return c.json(chain, 201);
  });

  app.delete('/failover-chains/:id', async (c) => {
    const id = c.req.param('id');
    await opRepo.remove('ai_failover_chain', id);
    return c.json({ success: true });
  });

  /* ──── Traces ──── */

  app.get('/traces', async (c) => {
    const { model, status, search, userId, instanceId, dateFrom, dateTo, page, limit } = c.req.query();
    const result = await repo.listTraces({
      model,
      status,
      search,
      userId,
      instanceId,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    const items = result.items.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        ...row,
        taskId: meta.task_id ?? meta.taskId ?? null,
        taskName: meta.task_name ?? meta.taskName ?? null,
        instruction: meta.instruction ?? meta.prompt ?? null,
        employeeName: meta.employee_name ?? meta.employeeName ?? row.instanceId ?? null,
      };
    });

    return c.json({
      items,
      traces: items,
      total: result.total,
      page: result.page,
    });
  });

  app.get('/traces/:id', async (c) => {
    const traceId = decodeURIComponent(c.req.param('id'));
    const detail = await repo.getTraceDetail(traceId);
    if (!detail) return c.json({ error: 'trace not found' }, 404);

    const meta = (detail.metadata ?? {}) as Record<string, unknown>;
    return c.json({
      trace: {
        ...detail,
        taskId: meta.task_id ?? meta.taskId ?? null,
        taskName: meta.task_name ?? meta.taskName ?? null,
        instruction: meta.instruction ?? meta.prompt ?? null,
        employeeName: meta.employee_name ?? meta.employeeName ?? detail.instanceId ?? null,
      },
    });
  });

  app.get('/stats', async (c) => {
    const { dateFrom, dateTo } = c.req.query();
    const stats = await repo.getTraceStats({ dateFrom, dateTo });
    return c.json(stats);
  });

  /* ──── Risk Rules（抽离至 ./ai-gateway/risk-rule-routes.ts） ──── */

  registerRiskRuleRoutes(app, repo);

  /* ──── Config ──── */

  /**
   * 读取持久化的 gateway 配置。未注入 configRepo（单元测试/降级场景）或表内无记录时，
   * 返回内存默认值，保证前端契约稳定。
   */
  async function readGatewayConfig() {
    if (!configRepo) return { ...DEFAULT_GATEWAY_CONFIG };
    const row = await configRepo.getSystemConfig(GATEWAY_CONFIG_KEY);
    if (!row?.value) return { ...DEFAULT_GATEWAY_CONFIG };
    try {
      const parsed = JSON.parse(row.value) as { provider?: unknown; timeout?: unknown };
      return {
        provider: typeof parsed.provider === 'string' ? parsed.provider : DEFAULT_GATEWAY_CONFIG.provider,
        timeout:
          typeof parsed.timeout === 'number' && Number.isFinite(parsed.timeout)
            ? parsed.timeout
            : DEFAULT_GATEWAY_CONFIG.timeout,
      };
    } catch {
      return { ...DEFAULT_GATEWAY_CONFIG };
    }
  }

  app.get('/config', async (c) => c.json(await readGatewayConfig()));

  app.put('/config', async (c) => {
    const parsed = await parseBody(c, gatewayConfigSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const config = parsed.data;

    if (configRepo) {
      await configRepo.setSystemConfig(GATEWAY_CONFIG_KEY, JSON.stringify(config), 'AI Gateway 全局配置');
    }
    return c.json({ success: true, config });
  });

  /* ──── Costs ──── */

  app.get('/costs', async (c) => {
    const { dateFrom, dateTo } = c.req.query();
    const analysis = await repo.getCostAnalysis({ dateFrom, dateTo });
    return c.json(analysis);
  });

  /* ──── Budgets ──── */

  app.get('/budget-status', async (c) => {
    const items = await opRepo.list('ai_budget');
    return c.json({ items });
  });

  app.get('/budgets', async (c) => {
    const rows = await opRepo.list('ai_budget');
    return c.json({ rows });
  });

  app.post('/budgets', async (c) => {
    const body = await c.req.json();
    const id = body.id || newId('budget');
    const budget = { id, ...body, updatedAt: new Date().toISOString() };
    await opRepo.upsert('ai_budget', id, budget);
    return c.json(budget, 201);
  });

  app.delete('/budgets/:id', async (c) => {
    const id = c.req.param('id');
    await opRepo.remove('ai_budget', id);
    return c.json({ success: true });
  });

  /* ──── Distributed Traces ──── */

  app.get('/dist-traces', async (c) => {
    const { status, userId, instanceId, search, dateFrom, dateTo, page, limit } = c.req.query();
    const result = await repo.listDistributedTraces({
      status,
      userId,
      instanceId,
      search,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return c.json({ items: result.items, total: result.total, page: result.page });
  });

  app.get('/dist-traces/:id', async (c) => {
    const traceId = decodeURIComponent(c.req.param('id'));
    const detail = await repo.getDistributedTraceDetail(traceId);
    if (!detail) return c.json({ error: 'trace not found' }, 404);
    return c.json({ trace: detail });
  });

  return app;
}
