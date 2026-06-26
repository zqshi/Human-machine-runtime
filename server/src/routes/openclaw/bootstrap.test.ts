import { describe, it, expect, vi } from 'vitest';
import { createOpenclawBootstrapRoutes } from './bootstrap.js';

function mockRepo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

describe('openclaw bootstrap routes', () => {
  it('GET /bootstrap returns quick commands(proactive 假数据已移除)', async () => {
    const repo = mockRepo();
    const app = createOpenclawBootstrapRoutes(repo as never);
    const res = await app.request('/bootstrap');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quickCommands).toBeDefined();
    expect(body.quickCommands).toHaveLength(4);
    // proactiveActivities/proactiveInsights 假数据已移除(无真实活动数据源,接真实数据后可恢复)
    expect(body.proactiveActivities).toBeUndefined();
    expect(body.proactiveInsights).toBeUndefined();
  });

  it('POST /agent/execute returns null intent without runtime service', async () => {
    const repo = mockRepo();
    const app = createOpenclawBootstrapRoutes(repo as never);
    const res = await app.request('/agent/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userText: 'hello', responseText: 'hi', sessionId: 's1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBeNull();
  });

  it('POST /agent/execute calls agentCore.harness.execute when provided', async () => {
    const repo = mockRepo();
    const execute = vi.fn().mockResolvedValue({ intent: 'greet' });
    const agentCore = { harness: { execute } } as never;
    const app = createOpenclawBootstrapRoutes(repo as never, agentCore);
    const res = await app.request('/agent/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userText: 'hello', responseText: 'hi', sessionId: 's1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe('greet');
    // 请求未带 tenantId → execute 第 4 参为 undefined（实现签名 execute(u, r, s, tenantId?)）
    expect(execute).toHaveBeenCalledWith('hello', 'hi', 's1', undefined);
  });

  it('POST /agent/execute forwards tenantId to agentCore.harness.execute when provided', async () => {
    const repo = mockRepo();
    const execute = vi.fn().mockResolvedValue({ intent: 'greet' });
    const agentCore = { harness: { execute } } as never;
    const app = createOpenclawBootstrapRoutes(repo as never, agentCore);
    const res = await app.request('/agent/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userText: 'hello',
        responseText: 'hi',
        sessionId: 's1',
        tenantId: 'tn_acme',
      }),
    });
    expect(res.status).toBe(200);
    expect(execute).toHaveBeenCalledWith('hello', 'hi', 's1', 'tn_acme');
  });

  it('GET /agent/status/:id returns task status from harness', async () => {
    const repo = mockRepo();
    const getTaskStatus = vi.fn().mockResolvedValue({
      taskId: 'tloop_1',
      state: 'completed',
      progress: 100,
      lastUpdatedAt: '2025-01-01T00:00:00Z',
    });
    const agentCore = { harness: { getTaskStatus } } as never;
    const app = createOpenclawBootstrapRoutes(repo as never, agentCore);
    const res = await app.request('/agent/status/tloop_1');
    expect(res.status).toBe(200);
    expect(getTaskStatus).toHaveBeenCalledWith('tloop_1');
    const body = await res.json();
    expect(body.state).toBe('completed');
    expect(body.taskId).toBe('tloop_1');
  });

  it('GET /agent/status/:id returns 503 without agentCore', async () => {
    const repo = mockRepo();
    const app = createOpenclawBootstrapRoutes(repo as never);
    const res = await app.request('/agent/status/tloop_1');
    expect(res.status).toBe(503);
  });

  it('GET /knowledge/patterns returns patterns', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([{ id: 'kp-1', keywords: ['test'] }]);
    const app = createOpenclawBootstrapRoutes(repo as never);
    const res = await app.request('/knowledge/patterns');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('GET /knowledge/patterns filters by keyword', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { id: 'kp-1', keywords: ['finance', 'report'] },
      { id: 'kp-2', keywords: ['marketing'] },
    ]);
    const app = createOpenclawBootstrapRoutes(repo as never);
    const res = await app.request('/knowledge/patterns?keyword=finance');
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('POST /evaluation/scorecards creates scorecard', async () => {
    const repo = mockRepo();
    const app = createOpenclawBootstrapRoutes(repo as never);
    const res = await app.request('/evaluation/scorecards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'agent', score: 85 }),
    });
    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalledWith('scorecard', expect.any(String), expect.any(Object));
  });
});
