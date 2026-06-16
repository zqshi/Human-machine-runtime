import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { OperationalRepository } from '../../db/repositories/operational-repository.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { LlmKeySyncService } from '../../contexts/gateway/llm-key-sync-service.js';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { Instance } from '../../contexts/tenant-instance/domain/instance.js';
import type { Principal } from '../../middleware/auth.js';
import { newId } from '../../shared/utils.js';
import { parseBody, badRequest } from '../../shared/validation.js';
import { logger } from '../../app/logger.js';

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

const createRiskRuleSchema = z.object({
  ruleId: z.string().optional(),
  displayName: z.string().min(1).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  pattern: z.string().optional(),
  ruleType: z.string().optional(),
  severity: z.string().optional(),
  priority: z.number().optional(),
  action: z.string().optional(),
  category: z.string().optional(),
  isEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const setModelGrantsSchema = z.object({
  instanceIds: z.array(z.string().min(1)).max(10000),
});

export function createAdminAiGatewayRoutes(
  repo: AiGatewayRepository,
  opRepo: OperationalRepository,
  litellmClient?: LiteLLMClient,
  instanceService?: InstanceService,
  keySyncService?: LlmKeySyncService
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

  /* ──── Risk Rules ──── */

  app.get('/risk-rules', async (c) => {
    const rules = await repo.listRiskRules();
    return c.json({ rules, rows: rules });
  });

  app.post('/risk-rules', async (c) => {
    const parsed = await parseBody(c, createRiskRuleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const body = parsed.data;
    const ruleId = body.ruleId || newId('rule');
    const rule = await repo.createRiskRule({
      ruleId,
      displayName: body.displayName || body.name || '未命名规则',
      description: body.description,
      pattern: body.pattern || body.ruleType || 'keyword',
      severity: body.severity || body.priority?.toString() || 'medium',
      action: body.action || 'block',
      category: body.category,
      isEnabled: body.isEnabled ?? body.isActive ?? true,
      sortOrder: body.sortOrder ?? body.priority,
    });
    return c.json(rule, 201);
  });

  app.put('/risk-rules/:id', async (c) => {
    const ruleId = decodeURIComponent(c.req.param('id'));
    const parsed = await parseBody(c, createRiskRuleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const rule = await repo.updateRiskRule(ruleId, parsed.data);
    if (!rule) return c.json({ error: 'rule not found' }, 404);
    return c.json(rule);
  });

  app.delete('/risk-rules/:id', async (c) => {
    const ruleId = decodeURIComponent(c.req.param('id'));
    const ok = await repo.deleteRiskRule(ruleId);
    return c.json({ success: ok });
  });

  app.post('/risk-rules/:id/toggle', async (c) => {
    const ruleId = decodeURIComponent(c.req.param('id'));
    const rule = await repo.toggleRiskRule(ruleId);
    if (!rule) return c.json({ error: 'rule not found' }, 404);
    return c.json({ success: true });
  });

  app.post('/risk-rules/test', async (c) => {
    const { text } = await c.req.json<{ text: string }>();
    const rules = await repo.listRiskRules();
    const hits = rules
      .filter((r) => r.isEnabled && text.includes(r.pattern))
      .map((r) => ({
        ruleId: r.ruleId,
        displayName: r.displayName,
        severity: r.severity,
        action: r.action,
      }));
    return c.json({ hits, tested: text.length });
  });

  app.get('/risk-rules/export', async (c) => {
    const rules = await repo.listRiskRules();
    return c.json({ rules });
  });

  app.post('/risk-rules/import', async (c) => {
    const { rules, mode } = await c.req.json<{
      rules: {
        displayName?: string;
        pattern?: string;
        severity?: string;
        action?: string;
        category?: string;
      }[];
      mode: string;
    }>();
    if (!Array.isArray(rules)) return c.json({ error: 'rules must be array' }, 400);

    let imported = 0;
    for (const r of rules) {
      if (!r.displayName || !r.pattern) continue;
      const ruleId = newId('rule');
      await repo.createRiskRule({
        ruleId,
        displayName: r.displayName,
        pattern: r.pattern,
        severity: r.severity || 'medium',
        action: r.action || 'block',
        category: r.category || 'imported',
        isEnabled: true,
      });
      imported++;
    }
    return c.json({ success: true, imported, mode });
  });

  /* ──── Config ──── */

  const gwConfig = { provider: 'multi', timeout: 30 };

  app.get('/config', (c) => c.json(gwConfig));

  app.put('/config', async (c) => {
    const body = await c.req.json();
    Object.assign(gwConfig, body);
    return c.json({ success: true });
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

  /* ──── Mock Data Seed ──── */

  app.post('/seed-dist-traces', async (c) => {
    const now = new Date();
    const traces: string[] = [];

    // Trace 1: 用户对话 — 多轮 LLM + 工具调用
    const t1Id = 'dt-user-chat-001';
    await repo.insertDistributedTrace({
      traceId: t1Id,
      rootOperation: 'user.chat',
      userId: 'u-zhangsan',
      instanceId: 'agent-cs-bot',
      sessionId: 'sess-20260608-001',
      tags: { source: 'openclaw', channel: 'web' },
    });
    traces.push(t1Id);

    // Span: gateway.receive
    await repo.insertTrace({
      traceId: 'span-gw-recv-001',
      distTraceId: t1Id,
      parentSpanId: undefined,
      operationName: 'gateway.receive',
      spanKind: 'server',
      sessionId: 'sess-20260608-001',
      requestId: 'req-gw-001',
      userId: 'u-zhangsan',
      instanceId: 'agent-cs-bot',
      requestedModel: 'auto',
      status: 'success',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 12,
      startTime: new Date(now.getTime() - 5200),
      createdAt: new Date(now.getTime() - 5200),
      completedAt: new Date(now.getTime() - 5188),
    });

    // Span: risk.check
    await repo.insertTrace({
      traceId: 'span-risk-001',
      distTraceId: t1Id,
      parentSpanId: 'span-gw-recv-001',
      operationName: 'risk.check',
      spanKind: 'internal',
      sessionId: 'sess-20260608-001',
      requestId: 'req-risk-001',
      userId: 'u-zhangsan',
      requestedModel: 'auto',
      status: 'success',
      promptTokens: 50,
      completionTokens: 0,
      latencyMs: 35,
      startTime: new Date(now.getTime() - 5180),
      createdAt: new Date(now.getTime() - 5180),
      completedAt: new Date(now.getTime() - 5145),
    });

    // Span: llm.call (第1轮)
    await repo.insertTrace({
      traceId: 'span-llm1-001',
      distTraceId: t1Id,
      parentSpanId: 'span-gw-recv-001',
      operationName: 'llm.call',
      spanKind: 'client',
      sessionId: 'sess-20260608-001',
      requestId: 'req-llm1-001',
      userId: 'u-zhangsan',
      instanceId: 'agent-cs-bot',
      requestedModel: 'claude-sonnet-4-6',
      actualModel: 'claude-sonnet-4-6',
      providerType: 'anthropic',
      status: 'success',
      promptTokens: 1200,
      completionTokens: 300,
      latencyMs: 2100,
      estimatedCost: 0.045,
      startTime: new Date(now.getTime() - 5100),
      createdAt: new Date(now.getTime() - 5100),
      completedAt: new Date(now.getTime() - 3000),
    });

    // Span: tool.exec (search)
    await repo.insertTrace({
      traceId: 'span-tool1-001',
      distTraceId: t1Id,
      parentSpanId: 'span-gw-recv-001',
      operationName: 'tool.exec',
      spanKind: 'client',
      sessionId: 'sess-20260608-001',
      requestId: 'req-tool-001',
      userId: 'u-zhangsan',
      instanceId: 'agent-cs-bot',
      requestedModel: 'auto',
      status: 'success',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 450,
      startTime: new Date(now.getTime() - 2950),
      createdAt: new Date(now.getTime() - 2950),
      completedAt: new Date(now.getTime() - 2500),
      metadata: { tool_name: 'knowledge_search', query: '退款政策' },
    });

    // Span: llm.call (第2轮 — 带工具结果)
    await repo.insertTrace({
      traceId: 'span-llm2-001',
      distTraceId: t1Id,
      parentSpanId: 'span-gw-recv-001',
      operationName: 'llm.call',
      spanKind: 'client',
      sessionId: 'sess-20260608-001',
      requestId: 'req-llm2-001',
      userId: 'u-zhangsan',
      instanceId: 'agent-cs-bot',
      requestedModel: 'claude-sonnet-4-6',
      actualModel: 'claude-sonnet-4-6',
      providerType: 'anthropic',
      status: 'success',
      promptTokens: 1800,
      completionTokens: 500,
      latencyMs: 2800,
      estimatedCost: 0.062,
      startTime: new Date(now.getTime() - 2450),
      createdAt: new Date(now.getTime() - 2450),
      completedAt: new Date(now.getTime() - 350),
    });

    // Span: gateway.respond
    await repo.insertTrace({
      traceId: 'span-gw-resp-001',
      distTraceId: t1Id,
      parentSpanId: undefined,
      operationName: 'gateway.respond',
      spanKind: 'server',
      sessionId: 'sess-20260608-001',
      requestId: 'req-gw-resp-001',
      userId: 'u-zhangsan',
      instanceId: 'agent-cs-bot',
      requestedModel: 'auto',
      status: 'success',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 8,
      startTime: new Date(now.getTime() - 340),
      createdAt: new Date(now.getTime() - 340),
      completedAt: new Date(now.getTime() - 332),
    });

    await repo.updateDistributedTrace(t1Id, {
      spanCount: 6,
      status: 'success',
      totalTokens: 3850,
      totalCost: 0.107,
      totalDurationMs: 5200,
      completedAt: new Date(now.getTime() - 332),
    });

    // Trace 2: 风险拦截场景
    const t2Id = 'dt-risk-block-002';
    await repo.insertDistributedTrace({
      traceId: t2Id,
      rootOperation: 'user.chat',
      userId: 'u-lisi',
      instanceId: 'agent-finance',
      sessionId: 'sess-20260608-002',
      tags: { source: 'openclaw', channel: 'api' },
    });
    traces.push(t2Id);

    await repo.insertTrace({
      traceId: 'span-gw-recv-002',
      distTraceId: t2Id,
      parentSpanId: undefined,
      operationName: 'gateway.receive',
      spanKind: 'server',
      sessionId: 'sess-20260608-002',
      requestId: 'req-gw-002',
      userId: 'u-lisi',
      instanceId: 'agent-finance',
      requestedModel: 'auto',
      status: 'success',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 10,
      startTime: new Date(now.getTime() - 800),
      createdAt: new Date(now.getTime() - 800),
      completedAt: new Date(now.getTime() - 790),
    });

    await repo.insertTrace({
      traceId: 'span-risk-002',
      distTraceId: t2Id,
      parentSpanId: 'span-gw-recv-002',
      operationName: 'risk.check',
      spanKind: 'internal',
      sessionId: 'sess-20260608-002',
      requestId: 'req-risk-002',
      userId: 'u-lisi',
      requestedModel: 'auto',
      status: 'blocked',
      promptTokens: 80,
      completionTokens: 0,
      latencyMs: 28,
      startTime: new Date(now.getTime() - 785),
      createdAt: new Date(now.getTime() - 785),
      completedAt: new Date(now.getTime() - 757),
    });

    await repo.insertTrace({
      traceId: 'span-llm1-002',
      distTraceId: t2Id,
      parentSpanId: 'span-gw-recv-002',
      operationName: 'llm.call',
      spanKind: 'client',
      sessionId: 'sess-20260608-002',
      requestId: 'req-llm1-002',
      userId: 'u-lisi',
      instanceId: 'agent-finance',
      requestedModel: 'gpt-4o',
      actualModel: 'gpt-4o',
      providerType: 'openai',
      status: 'error',
      promptTokens: 200,
      completionTokens: 0,
      latencyMs: 5000,
      estimatedCost: 0.01,
      startTime: new Date(now.getTime() - 750),
      createdAt: new Date(now.getTime() - 750),
      completedAt: new Date(now.getTime() - 200),
      metadata: { error: 'context_length_exceeded' },
    });

    await repo.updateDistributedTrace(t2Id, {
      spanCount: 3,
      status: 'blocked',
      totalTokens: 280,
      totalCost: 0.01,
      totalDurationMs: 800,
      completedAt: new Date(now.getTime() - 200),
    });

    // Trace 3: 工具重试场景
    const t3Id = 'dt-tool-retry-003';
    await repo.insertDistributedTrace({
      traceId: t3Id,
      rootOperation: 'agent.task',
      userId: 'u-wangwu',
      instanceId: 'agent-data-analyst',
      sessionId: 'sess-20260608-003',
      tags: { source: 'agent-scheduler' },
    });
    traces.push(t3Id);

    await repo.insertTrace({
      traceId: 'span-gw-recv-003',
      distTraceId: t3Id,
      parentSpanId: undefined,
      operationName: 'gateway.receive',
      spanKind: 'server',
      sessionId: 'sess-20260608-003',
      requestId: 'req-gw-003',
      userId: 'u-wangwu',
      instanceId: 'agent-data-analyst',
      requestedModel: 'auto',
      status: 'success',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 8,
      startTime: new Date(now.getTime() - 12000),
      createdAt: new Date(now.getTime() - 12000),
      completedAt: new Date(now.getTime() - 11992),
    });

    await repo.insertTrace({
      traceId: 'span-llm1-003',
      distTraceId: t3Id,
      parentSpanId: 'span-gw-recv-003',
      operationName: 'llm.call',
      spanKind: 'client',
      sessionId: 'sess-20260608-003',
      requestId: 'req-llm1-003',
      userId: 'u-wangwu',
      instanceId: 'agent-data-analyst',
      requestedModel: 'deepseek-chat',
      actualModel: 'deepseek-chat',
      providerType: 'deepseek',
      status: 'success',
      promptTokens: 800,
      completionTokens: 200,
      latencyMs: 1500,
      estimatedCost: 0.003,
      startTime: new Date(now.getTime() - 11900),
      createdAt: new Date(now.getTime() - 11900),
      completedAt: new Date(now.getTime() - 10400),
    });

    await repo.insertTrace({
      traceId: 'span-tool1-003',
      distTraceId: t3Id,
      parentSpanId: 'span-gw-recv-003',
      operationName: 'tool.exec',
      spanKind: 'client',
      sessionId: 'sess-20260608-003',
      requestId: 'req-tool-003a',
      userId: 'u-wangwu',
      instanceId: 'agent-data-analyst',
      requestedModel: 'auto',
      status: 'error',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 3000,
      startTime: new Date(now.getTime() - 10350),
      createdAt: new Date(now.getTime() - 10350),
      completedAt: new Date(now.getTime() - 7350),
      metadata: { tool_name: 'sql_query', error: 'connection_timeout' },
    });

    await repo.insertTrace({
      traceId: 'span-tool1-003r',
      distTraceId: t3Id,
      parentSpanId: 'span-gw-recv-003',
      operationName: 'tool.exec (retry)',
      spanKind: 'client',
      sessionId: 'sess-20260608-003',
      requestId: 'req-tool-003b',
      userId: 'u-wangwu',
      instanceId: 'agent-data-analyst',
      requestedModel: 'auto',
      status: 'success',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 1200,
      startTime: new Date(now.getTime() - 7300),
      createdAt: new Date(now.getTime() - 7300),
      completedAt: new Date(now.getTime() - 6100),
      metadata: { tool_name: 'sql_query', retry: true },
    });

    await repo.insertTrace({
      traceId: 'span-llm2-003',
      distTraceId: t3Id,
      parentSpanId: 'span-gw-recv-003',
      operationName: 'llm.call',
      spanKind: 'client',
      sessionId: 'sess-20260608-003',
      requestId: 'req-llm2-003',
      userId: 'u-wangwu',
      instanceId: 'agent-data-analyst',
      requestedModel: 'deepseek-chat',
      actualModel: 'deepseek-chat',
      providerType: 'deepseek',
      status: 'success',
      promptTokens: 1200,
      completionTokens: 400,
      latencyMs: 2000,
      estimatedCost: 0.005,
      startTime: new Date(now.getTime() - 6050),
      createdAt: new Date(now.getTime() - 6050),
      completedAt: new Date(now.getTime() - 4050),
    });

    await repo.insertTrace({
      traceId: 'span-gw-resp-003',
      distTraceId: t3Id,
      parentSpanId: undefined,
      operationName: 'gateway.respond',
      spanKind: 'server',
      sessionId: 'sess-20260608-003',
      requestId: 'req-gw-resp-003',
      userId: 'u-wangwu',
      instanceId: 'agent-data-analyst',
      requestedModel: 'auto',
      status: 'success',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 5,
      startTime: new Date(now.getTime() - 4040),
      createdAt: new Date(now.getTime() - 4040),
      completedAt: new Date(now.getTime() - 4035),
    });

    await repo.updateDistributedTrace(t3Id, {
      spanCount: 6,
      status: 'success',
      totalTokens: 2600,
      totalCost: 0.008,
      totalDurationMs: 12000,
      completedAt: new Date(now.getTime() - 4035),
    });

    return c.json({ seeded: traces, count: traces.length }, 201);
  });

  return app;
}
