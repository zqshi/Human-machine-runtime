import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createAdminAssistantRoutes } from './ai-assistant.js';

function mockUser() {
  return { username: 'admin1', tenantId: 'tn_test', roles: ['admin'] };
}

function withAuth(app: Hono) {
  const wrapper = new Hono();
  wrapper.use('*', async (c, next) => {
    c.set('user', mockUser());
    await next();
  });
  wrapper.route('/', app);
  return wrapper;
}

function mockLitellm() {
  return {
    isConfigured: vi.fn().mockReturnValue(true),
    listModels: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4o-mini' }] }),
    chatCompletion: vi.fn().mockResolvedValue({
      id: 'chatcmpl-1',
      model: 'claude-3-sonnet',
      choices: [{ message: { content: '这是AI回复' } }],
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    }),
  };
}

function mockAnalytics() {
  return {
    getHealthMetrics: vi.fn().mockResolvedValue({ score: 95 }),
    getAlerts: vi.fn().mockResolvedValue({ activeAlerts: 0, alerts: [] }),
  };
}

function mockClusterInstanceClient() {
  return {
    isConfigured: vi.fn().mockReturnValue(true),
    listInstances: vi.fn().mockResolvedValue({
      items: [
        {
          name: 'openclaw-1',
          podName: 'pod-1',
          status: 'running',
          nodeName: 'node-1',
          employeeNumber: 1,
          userId: 'u1',
          appKey: 'default',
          pvcName: '',
          svcName: '',
          managedBy: 'system',
          lastActive: '',
          createdAt: '',
          isActive: true,
        },
        {
          name: 'openclaw-2',
          podName: 'pod-2',
          status: 'stopped',
          nodeName: 'node-1',
          employeeNumber: 2,
          userId: 'u2',
          appKey: 'default',
          pvcName: '',
          svcName: '',
          managedBy: 'system',
          lastActive: '',
          createdAt: '',
          isActive: false,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    }),
  };
}

function mockAiRepo() {
  return {
    insertTrace: vi.fn().mockResolvedValue(undefined),
    getTraceStats: vi.fn().mockResolvedValue({
      totalCalls: 100,
      totalTokens: 5000,
      avgLatency: 200,
      errorRate: 1.5,
    }),
    listModels: vi.fn().mockResolvedValue([]),
  };
}

describe('admin ai-assistant routes', () => {
  it('POST /chat returns reply from LiteLLM', async () => {
    const litellm = mockLitellm();
    const analytics = mockAnalytics();
    const clawMgr = mockClusterInstanceClient();
    const aiRepo = mockAiRepo();
    const routes = createAdminAssistantRoutes(
      litellm as never,
      analytics as never,
      clawMgr as never,
      aiRepo as never
    );
    const app = withAuth(routes);

    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '查看实例状态' }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe('这是AI回复');
    expect(litellm.chatCompletion).toHaveBeenCalled();
  });

  it('POST /chat returns fallback when no LiteLLM configured', async () => {
    const analytics = mockAnalytics();
    const clawMgr = mockClusterInstanceClient();
    const routes = createAdminAssistantRoutes(undefined, analytics as never, clawMgr as never);
    const app = withAuth(routes);

    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toContain('不可用');
  });

  it('POST /chat returns 400 on invalid messages', async () => {
    const litellm = mockLitellm();
    const analytics = mockAnalytics();
    const clawMgr = mockClusterInstanceClient();
    const routes = createAdminAssistantRoutes(
      litellm as never,
      analytics as never,
      clawMgr as never
    );
    const app = withAuth(routes);

    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /chat returns 500 on LiteLLM error', async () => {
    const litellm = {
      isConfigured: vi.fn().mockReturnValue(true),
      listModels: vi.fn().mockResolvedValue({ data: [] }),
      chatCompletion: vi.fn().mockRejectedValue(new Error('timeout')),
    };
    const analytics = mockAnalytics();
    const clawMgr = mockClusterInstanceClient();
    const aiRepo = mockAiRepo();
    const routes = createAdminAssistantRoutes(
      litellm as never,
      analytics as never,
      clawMgr as never,
      aiRepo as never
    );
    const app = withAuth(routes);

    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.reply).toContain('连接失败');
  });

  it('GET /context returns platform summary', async () => {
    const analytics = mockAnalytics();
    const clawMgr = mockClusterInstanceClient();
    const routes = createAdminAssistantRoutes(undefined, analytics as never, clawMgr as never);
    const app = withAuth(routes);

    const res = await app.request('/context');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toContain('数字员工实例');
  });
});
