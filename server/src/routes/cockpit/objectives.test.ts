import { describe, it, expect, vi } from 'vitest';
import { createCockpitObjectiveRoutes } from './objectives.js';
import type {
  ObjectiveService,
  DecodeResult,
  DecodedStrategy,
} from '../../contexts/cockpit/application/objective-service.js';

/** 构造 mock ObjectiveService（route 只调其方法 + 对返回实体的 toProps）。 */
function mockObjectiveService(overrides: Partial<ObjectiveService> = {}) {
  return {
    listObjectives: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    createObjective: vi.fn(),
    getObjective: vi.fn().mockResolvedValue(null),
    updateObjective: vi.fn().mockResolvedValue(null),
    deleteObjective: vi.fn().mockResolvedValue(true),
    decodeStrategy: vi.fn(),
    ...overrides,
  } as unknown as ObjectiveService;
}

/** 模拟 Objective 实体（route serialize 只调 toProps）。 */
function makeObjective(id: string, level: string) {
  return {
    toProps: () => ({
      id,
      level,
      parentId: undefined,
      title: 'Goal',
      description: 'd',
      confidence: 0.5,
      status: 'active',
      metrics: { completionRate: 0, acceptanceRate: 0, avgDurationMs: 0, tokensCost: 0 },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }),
  } as never;
}

describe('cockpit objective routes', () => {
  it('GET / returns objectives', async () => {
    const svc = mockObjectiveService({
      listObjectives: vi.fn().mockResolvedValue({
        items: [makeObjective('obj-1', 'L0')],
        total: 1,
        limit: 50,
        offset: 0,
      }),
    });
    const app = createCockpitObjectiveRoutes(svc);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].level).toBe('L0');
  });

  it('GET / passes level filter to service', async () => {
    const svc = mockObjectiveService();
    const app = createCockpitObjectiveRoutes(svc);
    await app.request('/?level=L0');
    expect(svc.listObjectives).toHaveBeenCalledWith(expect.objectContaining({ level: 'L0' }));
  });

  it('POST / creates objective', async () => {
    const svc = mockObjectiveService({
      createObjective: vi.fn().mockResolvedValue(makeObjective('obj-1', 'L0')),
    });
    const app = createCockpitObjectiveRoutes(svc);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Goal', level: 'L0' }),
    });
    expect(res.status).toBe(201);
    expect(svc.createObjective).toHaveBeenCalled();
  });

  it('GET /:id returns 404 when not found', async () => {
    const svc = mockObjectiveService({ getObjective: vi.fn().mockResolvedValue(null) });
    const app = createCockpitObjectiveRoutes(svc);
    const res = await app.request('/obj-999');
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes objective', async () => {
    const svc = mockObjectiveService({ deleteObjective: vi.fn().mockResolvedValue(true) });
    const app = createCockpitObjectiveRoutes(svc);
    const res = await app.request('/obj-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(svc.deleteObjective).toHaveBeenCalledWith('obj-1');
  });

  it('POST /decode returns 503 when LLM not configured', async () => {
    const svc = mockObjectiveService({
      decodeStrategy: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        reason: '战略解码服务未配置(LLM 未就绪)',
      } as DecodeResult),
    });
    const app = createCockpitObjectiveRoutes(svc);
    const res = await app.request('/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: '提高客户满意度' }),
    });
    expect(res.status).toBe(503);
  });

  it('POST /decode returns structured analysis from real LLM', async () => {
    const data: DecodedStrategy = {
      questions: [{ id: 'q1', question: '核心目标是什么?', purpose: 'clarify' }],
      hypotheses: [{ id: 'h1', statement: '可实现 80%', baselineValue: 50, targetValue: 80 }],
      constraints: ['资源有限'],
      suggestedL1Objectives: [{ title: '明确指标', keyQuestion: '哪些指标?' }],
    };
    const svc = mockObjectiveService({
      decodeStrategy: vi.fn().mockResolvedValue({ ok: true, data } as DecodeResult),
    });
    const app = createCockpitObjectiveRoutes(svc);
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
    const svc = mockObjectiveService({
      decodeStrategy: vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        reason: '战略解码输出不可解析',
      } as DecodeResult),
    });
    const app = createCockpitObjectiveRoutes(svc);
    const res = await app.request('/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'test' }),
    });
    expect(res.status).toBe(502);
  });
});
