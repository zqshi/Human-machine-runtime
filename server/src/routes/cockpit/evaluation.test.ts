import { describe, it, expect, vi } from 'vitest';
import { createCockpitEvaluationRoutes } from './evaluation.js';

function mockRepo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    listPaged: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    get: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

function mockLlm(content: string | null) {
  return {
    isConfigured: () => true,
    chatCompletion: vi.fn().mockResolvedValue({
      choices: content === null ? [] : [{ message: { content } }],
    }),
  } as never;
}

describe('cockpit evaluation routes', () => {
  it('GET /evaluation/metrics filters by dimension', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { id: 'm1', dimension: 'agent', score: 85 },
      { id: 'm2', dimension: 'human', score: 70 },
    ]);
    const app = createCockpitEvaluationRoutes(repo as never);
    const res = await app.request('/evaluation/metrics?dimension=agent');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].dimension).toBe('agent');
  });

  it('POST /evaluation/metrics creates metric', async () => {
    const repo = mockRepo();
    const app = createCockpitEvaluationRoutes(repo as never);
    const res = await app.request('/evaluation/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimension: 'agent', score: 90 }),
    });
    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalled();
  });

  it('POST /evaluation/scorecards computes overallScore from scores', async () => {
    const repo = mockRepo();
    const app = createCockpitEvaluationRoutes(repo as never);
    const res = await app.request('/evaluation/scorecards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores: [{ value: 80 }, { value: 60 }] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.overallScore).toBe(70);
  });

  it('GET /evaluation/dual-track returns LLM-generated insights', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { dimension: 'human', score: 70 },
      { dimension: 'agent', score: 85 },
    ]);
    const llm = mockLlm('["Agent 执行效率高于人工","人工质量更稳"]');
    const app = createCockpitEvaluationRoutes(repo as never, llm, 'glm-4-flash');
    const res = await app.request('/evaluation/dual-track');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comparisonInsights).toEqual(['Agent 执行效率高于人工', '人工质量更稳']);
    expect(body.humanTrack.summary.avgScore).toBe(70);
    expect(body.agentTrack.summary.avgScore).toBe(85);
  });

  it('GET /evaluation/dual-track returns empty insights when LLM not configured', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([{ dimension: 'human', score: 70 }]);
    const app = createCockpitEvaluationRoutes(repo as never); // 无 llm → [] 不回退文案
    const res = await app.request('/evaluation/dual-track');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comparisonInsights).toEqual([]);
  });

  it('GET /evaluation/dual-track returns empty insights when no metrics data', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([]);
    const llm = mockLlm('["洞察"]');
    const app = createCockpitEvaluationRoutes(repo as never, llm, 'glm-4-flash');
    const res = await app.request('/evaluation/dual-track');
    const body = await res.json();
    expect(body.comparisonInsights).toEqual([]);
  });

  it('GET /evaluation/dual-track returns empty insights when LLM output unparseable', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { dimension: 'human', score: 70 },
      { dimension: 'agent', score: 85 },
    ]);
    const llm = mockLlm('不是 JSON');
    const app = createCockpitEvaluationRoutes(repo as never, llm, 'glm-4-flash');
    const res = await app.request('/evaluation/dual-track');
    const body = await res.json();
    expect(body.comparisonInsights).toEqual([]);
  });

  it('GET /evaluation/trends returns sorted data points', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { createdAt: 200, score: 60 },
      { createdAt: 100, score: 50 },
    ]);
    const app = createCockpitEvaluationRoutes(repo as never);
    const res = await app.request('/evaluation/trends');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dataPoints).toHaveLength(2);
    expect(body.dataPoints[0].createdAt).toBe(100);
  });
});
