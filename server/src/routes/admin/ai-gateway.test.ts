import { describe, it, expect, vi } from 'vitest';
import { createAdminAiGatewayRoutes } from './ai-gateway.js';
import { Hono } from 'hono';

const MOCK_MODEL = {
  id: 1,
  displayName: 'GPT-4o',
  description: 'OpenAI flagship',
  providerType: 'openai',
  protocolType: 'openai',
  baseUrl: 'https://api.openai.com',
  providerModelName: 'gpt-4o',
  modelName: 'gpt-4o',
  apiKey: 'sk-***',
  apiKeySecretRef: null,
  isSecure: false,
  isActive: true,
  inputPrice: 5,
  outputPrice: 15,
  cacheReadCost: null,
  cacheCreationCost: null,
  currency: 'USD',
  maxTokens: 128000,
  timeout: 600,
  streamTimeout: 45,
  rateLimitPerMin: 60,
};

const MOCK_RULE = {
  ruleId: 'rule-1',
  displayName: 'Block profanity',
  description: 'Blocks profanity in output',
  pattern: 'badword',
  severity: 'high',
  action: 'block',
  category: 'content',
  isEnabled: true,
  sortOrder: 1,
};

const MOCK_TRACE = {
  traceId: 'trc-1',
  requestId: 'req-1',
  sessionId: 'sess-1',
  userId: 'u1',
  instanceId: 'agent-1',
  requestedModel: 'gpt-4o',
  actualModel: 'gpt-4o',
  status: 'error',
  promptTokens: 100,
  completionTokens: 20,
  latencyMs: 4200,
  metadata: { task_id: 'task-1', instruction: 'diagnose trace' },
};

const MOCK_TRACE_DETAIL = {
  ...MOCK_TRACE,
  chain: [{ nodeId: 'node-1', stage: 'runtime.ensure', status: 'failed', durationMs: 4200 }],
  spans: [{
    spanId: 'span-1',
    parentId: null,
    operationName: 'runtime.ensure',
    startTime: '2026-06-08T00:00:00.000Z',
    durationMs: 4200,
    status: 'failed',
    depth: 0,
    tags: null,
    children: [],
  }],
  spanList: [{
    spanId: 'span-1',
    parentId: null,
    operationName: 'runtime.ensure',
    startTime: '2026-06-08T00:00:00.000Z',
    durationMs: 4200,
    status: 'failed',
    depth: 0,
    tags: null,
  }],
  riskHits: [{ ruleName: 'Block profanity', severity: 'high', action: 'block', matchSummary: 'badword' }],
};

function mockDeps() {
  return {
    repo: {
      listModels: vi.fn().mockResolvedValue([MOCK_MODEL]),
      createModel: vi.fn().mockResolvedValue({ ...MOCK_MODEL, id: 2, displayName: 'Claude-3' }),
      updateModel: vi.fn().mockResolvedValue({ ...MOCK_MODEL, displayName: 'Updated' }),
      deleteModel: vi.fn().mockResolvedValue(true),
      toggleModel: vi.fn().mockResolvedValue({ ...MOCK_MODEL, isActive: false }),
      getModel: vi.fn().mockResolvedValue(MOCK_MODEL),
      listTraces: vi.fn().mockResolvedValue({
        items: [MOCK_TRACE],
        total: 1,
        page: 1,
      }),
      getTraceDetail: vi.fn().mockResolvedValue(MOCK_TRACE_DETAIL),
      getTraceStats: vi.fn().mockResolvedValue({
        totalCalls: 200,
        completed: 180,
        blocked: 5,
        failed: 15,
        avgLatency: 800,
        errorRate: 7.5,
        totalTokens: 40000,
      }),
      listRiskRules: vi.fn().mockResolvedValue([MOCK_RULE]),
      createRiskRule: vi.fn().mockResolvedValue({ ...MOCK_RULE, ruleId: 'rule-2' }),
      updateRiskRule: vi.fn().mockResolvedValue({ ...MOCK_RULE, displayName: 'Updated rule' }),
      deleteRiskRule: vi.fn().mockResolvedValue(true),
      toggleRiskRule: vi.fn().mockResolvedValue({ ...MOCK_RULE, isEnabled: false }),
      getCostSummary: vi.fn().mockResolvedValue({ totalCost: 42.5, currency: 'USD' }),
      getCostAnalysis: vi.fn().mockResolvedValue({
        totalPromptTokens: 10000,
        totalCompletionTokens: 5000,
        totalEstimatedCost: 42.5,
        deptSummary: [
          { department: '研发部', users: 2, count: 10, totalTokens: 15000, estimatedCost: 42.5 },
        ],
        userSummary: [
          {
            userId: 'u1',
            department: '研发部',
            count: 10,
            totalTokens: 15000,
            estimatedCost: 42.5,
          },
        ],
        modelSummary: [{ model: 'gpt-4o', count: 10, totalTokens: 15000, estimatedCost: 42.5 }],
        dailyTrend: [],
      }),
      // ── grants ──
      listGrantsByModel: vi.fn().mockResolvedValue(['inst-1', 'inst-2']),
      listGrantsByInstance: vi.fn().mockResolvedValue([1]),
      setModelGrants: vi.fn().mockResolvedValue(['inst-1', 'inst-3']),
      countGrantsByModel: vi.fn().mockResolvedValue([
        { modelId: 1, count: 2 },
        { modelId: 2, count: 0 },
      ]),
    },
    opRepo: {
      list: vi.fn().mockResolvedValue([{ id: 'fc-1', name: 'chain-1' }]),
      upsert: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    configRepo: {
      getSystemConfig: vi.fn().mockResolvedValue(null),
      setSystemConfig: vi.fn().mockResolvedValue(undefined),
    },
    litellmClient: {
      isConfigured: vi.fn().mockReturnValue(false),
      listModels: vi.fn().mockResolvedValue([]),
      healthCheck: vi.fn().mockResolvedValue({ status: 'ok' }),
    },
    instanceService: {
      list: vi.fn().mockResolvedValue([
        {
          id: 'inst-1',
          name: '客服助手',
          tenantId: 'default',
          departmentId: 'dept-1',
          department: '客服部',
          enterpriseUserId: 'u-zhangsan',
          jobTitle: '客服专员',
          state: 'running',
        },
        {
          id: 'inst-2',
          name: '共享 Bot',
          tenantId: 'default',
          departmentId: null,
          department: '',
          enterpriseUserId: null,
          jobTitle: '',
          state: 'running',
        },
      ]),
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

describe('admin ai-gateway routes', () => {
  /* ──── Models ──── */

  it('GET /models returns model list', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      deps.litellmClient as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/models');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.models).toHaveLength(1);
    expect(body.models[0].displayName).toBe('GPT-4o');
    expect(body.remote).toBeNull();
  });

  it('GET /models includes remote when litellm configured', async () => {
    const deps = mockDeps();
    deps.litellmClient.isConfigured.mockReturnValue(true);
    deps.litellmClient.listModels.mockResolvedValue([{ id: 'remote-1' }]);
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      deps.litellmClient as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/models');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.remote).toHaveLength(1);
  });

  it('POST /models creates a model', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Claude-3', provider: 'anthropic' }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.displayName).toBe('Claude-3');
    expect(deps.repo.createModel).toHaveBeenCalledOnce();
  });

  it('PUT /models/:id updates a model', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Updated' }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.displayName).toBe('Updated');
  });

  it('PUT /models/:id returns 404 when not found', async () => {
    const deps = mockDeps();
    deps.repo.updateModel.mockResolvedValue(null);
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ghost' }),
    });
    expect(res.status).toBe(404);
  });

  it('DELETE /models/:id deletes a model', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/1', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(deps.repo.deleteModel).toHaveBeenCalledWith(1);
  });

  it('POST /models/:id/toggle toggles model status', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/1/toggle', { method: 'POST' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('POST /models/:id/toggle returns 404 when not found', async () => {
    const deps = mockDeps();
    deps.repo.toggleModel.mockResolvedValue(null);
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/999/toggle', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  /* ──── Traces ──── */

  it('GET /traces returns paginated trace list', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/traces?page=1&limit=10');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
  });

  it('GET /traces forwards trace filters', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/traces?userId=u1&instanceId=agent-1&model=gpt-4o&status=error&dateFrom=2026-01-01&dateTo=2026-01-31');
    expect(res.status).toBe(200);
    expect(deps.repo.listTraces).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        instanceId: 'agent-1',
        model: 'gpt-4o',
        status: 'error',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      })
    );
  });

  it('GET /traces/:id returns full trace detail', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/traces/trc-1');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.trace.traceId).toBe('trc-1');
    expect(body.trace.taskId).toBe('task-1');
    expect(body.trace.chain).toHaveLength(1);
    expect(body.trace.spans).toHaveLength(1);
    expect(body.trace.spanList).toHaveLength(1);
    expect(body.trace.spans[0].spanId).toBe('span-1');
    expect(body.trace.spans[0].parentId).toBeNull();
    expect(body.trace.spanList[0].operationName).toBe('runtime.ensure');
    expect(body.trace.riskHits).toHaveLength(1);
  });

  it('GET /traces/:id returns 404 when trace is missing', async () => {
    const deps = mockDeps();
    deps.repo.getTraceDetail.mockResolvedValue(null);
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/traces/missing');
    expect(res.status).toBe(404);
  });

  /* ──── Stats ──── */

  it('GET /stats returns trace statistics', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/stats');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalCalls).toBe(200);
    expect(body.completed).toBe(180);
    expect(body.blocked).toBe(5);
    expect(body.failed).toBe(15);
    expect(body.avgLatency).toBe(800);
  });

  /* ──── Risk Rules ──── */

  it('GET /risk-rules returns rules list', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/risk-rules');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0].ruleId).toBe('rule-1');
    expect(body.rows).toHaveLength(1);
  });

  it('POST /risk-rules creates a rule', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/risk-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Rule', pattern: 'spam' }),
    });
    expect(res.status).toBe(201);
    expect(deps.repo.createRiskRule).toHaveBeenCalledOnce();
  });

  it('DELETE /risk-rules/:id deletes a rule', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/risk-rules/rule-1', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });

  /* ──── Providers ──── */

  it('GET /providers returns builtin provider list', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/providers');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.providers.length).toBeGreaterThanOrEqual(8);
    expect(body.providers[0]).toHaveProperty('id');
    expect(body.providers[0]).toHaveProperty('name');
    expect(body.providers[0]).toHaveProperty('baseUrl');
  });

  /* ──── Failover Chains ──── */

  it('GET /failover-chains returns chain list', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/failover-chains');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.rows).toHaveLength(1);
  });

  /* ──── Config ──── */

  it('GET /config returns default when no persisted config', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      undefined,
      undefined,
      undefined,
      deps.configRepo as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/config');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.provider).toBe('multi');
    expect(body.timeout).toBe(30);
    expect(deps.configRepo.getSystemConfig).toHaveBeenCalledWith('ai_gateway.config');
  });

  it('GET /config returns persisted config', async () => {
    const deps = mockDeps();
    deps.configRepo.getSystemConfig.mockResolvedValue({
      key: 'ai_gateway.config',
      value: JSON.stringify({ provider: 'single', timeout: 60 }),
    });
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      undefined,
      undefined,
      undefined,
      deps.configRepo as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/config');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.provider).toBe('single');
    expect(body.timeout).toBe(60);
  });

  it('PUT /config persists validated config to system_configs', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      undefined,
      undefined,
      undefined,
      deps.configRepo as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'failover', timeout: 45 }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.config).toEqual({ provider: 'failover', timeout: 45 });
    expect(deps.configRepo.setSystemConfig).toHaveBeenCalledWith(
      'ai_gateway.config',
      JSON.stringify({ provider: 'failover', timeout: 45 }),
      'AI Gateway 全局配置'
    );
  });

  it('PUT /config rejects invalid body (non-integer timeout)', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      undefined,
      undefined,
      undefined,
      deps.configRepo as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'x', timeout: 1.5 }),
    });
    expect(res.status).toBe(400);
    expect(deps.configRepo.setSystemConfig).not.toHaveBeenCalled();
  });

  /* ──── Costs ──── */

  it('GET /costs returns cost summary', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/costs');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalEstimatedCost).toBe(42.5);
    expect(body.deptSummary).toHaveLength(1);
    expect(body.deptSummary[0].department).toBe('研发部');
  });

  /* ──── LiteLLM Health ──── */

  it('GET /litellm-health returns unconfigured when no client', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(deps.repo as never, deps.opRepo as never);
    const app = wrapWithAuth(inner);

    const res = await app.request('/litellm-health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('unconfigured');
  });

  it('GET /litellm-health returns ok when healthy', async () => {
    const deps = mockDeps();
    deps.litellmClient.isConfigured.mockReturnValue(true);
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      deps.litellmClient as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/litellm-health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  /* ──── Model Grants ──── */

  it('GET /models/grants-count returns count map', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      deps.litellmClient as never,
      deps.instanceService as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/grants-count');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts['1']).toBe(2);
    expect(body.counts['2']).toBe(0);
  });

  it('GET /models/:id/grants returns grants + instances', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      deps.litellmClient as never,
      deps.instanceService as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/1/grants');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.grants).toEqual(['inst-1', 'inst-2']);
    expect(body.instances).toHaveLength(2);
    expect(body.instances[0]).toMatchObject({ id: 'inst-1', department: '客服部' });
  });

  it('GET /models/:id/grants 404 when model missing', async () => {
    const deps = mockDeps();
    deps.repo.getModel.mockResolvedValue(null);
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      deps.litellmClient as never,
      deps.instanceService as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/999/grants');
    expect(res.status).toBe(404);
  });

  it('PUT /models/:id/grants writes grants and echoes result', async () => {
    const deps = mockDeps();
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      deps.litellmClient as never,
      deps.instanceService as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/1/grants', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceIds: ['inst-1', 'inst-3'] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.grants).toEqual(['inst-1', 'inst-3']);
    // tenantId 从首个 instance 反查；actor 取 auth 注入的 username
    expect(deps.repo.setModelGrants).toHaveBeenCalledWith(1, ['inst-1', 'inst-3'], 'default', 'admin');
  });

  it('PUT /models/:id/grants rejects empty tenantId when instance unknown', async () => {
    const deps = mockDeps();
    deps.instanceService.list.mockResolvedValue([]);
    const inner = createAdminAiGatewayRoutes(
      deps.repo as never,
      deps.opRepo as never,
      deps.litellmClient as never,
      deps.instanceService as never
    );
    const app = wrapWithAuth(inner);

    const res = await app.request('/models/1/grants', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceIds: ['inst-9'] }),
    });
    expect(res.status).toBe(400);
    expect(deps.repo.setModelGrants).not.toHaveBeenCalled();
  });
});
