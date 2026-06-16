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
  it('GET /bootstrap returns quick commands and activities', async () => {
    const repo = mockRepo();
    const app = createOpenclawBootstrapRoutes(repo as never);
    const res = await app.request('/bootstrap');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quickCommands).toBeDefined();
    expect(body.proactiveActivities).toBeDefined();
    expect(body.proactiveInsights).toBeDefined();
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

  it('POST /agent/execute calls runtime service when provided', async () => {
    const repo = mockRepo();
    const runtimeSvc = { execute: vi.fn().mockResolvedValue({ intent: 'greet' }) };
    const app = createOpenclawBootstrapRoutes(repo as never, runtimeSvc as never);
    const res = await app.request('/agent/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userText: 'hello', responseText: 'hi', sessionId: 's1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe('greet');
    expect(runtimeSvc.execute).toHaveBeenCalledWith('hello', 'hi', 's1');
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
