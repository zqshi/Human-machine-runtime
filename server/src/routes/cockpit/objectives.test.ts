import { describe, it, expect, vi } from 'vitest';
import { createCockpitObjectiveRoutes } from './objectives.js';

function mockRepo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
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

describe('cockpit objective routes', () => {
  it('GET / returns objectives', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([{ id: 'obj-1', level: 'L0', title: 'Goal' }]);
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('GET / filters by level', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { id: 'obj-1', level: 'L0' },
      { id: 'obj-2', level: 'L1' },
    ]);
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/?level=L0');
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].level).toBe('L0');
  });

  it('POST / creates objective', async () => {
    const repo = mockRepo();
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Goal', level: 'L0' }),
    });
    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalled();
  });

  it('GET /:id returns 404 when not found', async () => {
    const repo = mockRepo();
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/obj-999');
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes objective', async () => {
    const repo = mockRepo();
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/obj-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(repo.remove).toHaveBeenCalledWith('objective', 'obj-1');
  });

  it('POST /decode returns 503 when LLM not configured', async () => {
    const repo = mockRepo();
    const app = createCockpitObjectiveRoutes(repo as never); // 无 llm → 503 故障暴露
    const res = await app.request('/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: '提高客户满意度' }),
    });
    expect(res.status).toBe(503);
  });

  it('POST /decode returns structured analysis from real LLM', async () => {
    const repo = mockRepo();
    const llm = mockLlm(
      JSON.stringify({
        questions: [{ id: 'q1', question: '核心目标是什么?', purpose: 'clarify' }],
        hypotheses: [
          { id: 'h1', statement: '可实现 80%', baselineValue: 50, targetValue: 80 },
        ],
        constraints: ['资源有限'],
        suggestedL1Objectives: [{ title: '明确指标', keyQuestion: '哪些指标?' }],
      })
    );
    const app = createCockpitObjectiveRoutes(repo as never, llm, 'glm-4-flash');
    const res = await app.request('/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: '东南亚营收翻倍' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(1);
    expect(body.hypotheses[0].targetValue).toBe(80);
    expect(body.constraints).toContain('资源有限');
  });

  it('POST /decode returns 502 when LLM output unparseable', async () => {
    const repo = mockRepo();
    const llm = mockLlm('这不是 JSON');
    const app = createCockpitObjectiveRoutes(repo as never, llm, 'glm-4-flash');
    const res = await app.request('/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'test' }),
    });
    expect(res.status).toBe(502);
  });
});
