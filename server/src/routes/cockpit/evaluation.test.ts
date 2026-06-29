import { describe, it, expect, vi } from 'vitest';
import { createCockpitEvaluationRoutes } from './evaluation.js';
import { EvaluationMetric } from '../../contexts/cockpit/domain/evaluation/evaluation-metric.js';
import { Scorecard } from '../../contexts/cockpit/domain/evaluation/scorecard.js';

function mockService() {
  return {
    listMetrics: vi.fn(),
    createMetric: vi.fn(),
    listScorecards: vi.fn(),
    createScorecard: vi.fn(),
    getScorecard: vi.fn(),
    dualTrack: vi.fn(),
    trends: vi.fn(),
  };
}

const fixedDate = new Date('2026-01-01T00:00:00Z');

function makeMetric(dimension: 'human' | 'agent', score: number) {
  return EvaluationMetric.fromProps({
    id: 'm1',
    dimension,
    score,
    metadata: {},
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}

function makeScorecard(scores: Array<{ value: number }>, overallScore: number) {
  return Scorecard.fromProps({
    id: 'sc1',
    scores,
    overallScore,
    metadata: {},
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}

describe('cockpit evaluation routes', () => {
  it('GET /evaluation/metrics 透传 dimension + 序列化 Date→ms', async () => {
    const svc = mockService();
    svc.listMetrics.mockResolvedValue({
      items: [makeMetric('agent', 85)],
      total: 1,
      limit: 50,
      offset: 0,
    });
    const app = createCockpitEvaluationRoutes(svc as never);
    const res = await app.request('/evaluation/metrics?dimension=agent');
    expect(res.status).toBe(200);
    expect(svc.listMetrics).toHaveBeenCalledWith({
      dimension: 'agent',
      limit: undefined,
      offset: undefined,
    });
    const body = await res.json();
    expect(body.items[0].dimension).toBe('agent');
    expect(body.items[0].createdAt).toBe(fixedDate.getTime());
  });

  it('POST /evaluation/metrics 调 createMetric + 201', async () => {
    const svc = mockService();
    svc.createMetric.mockResolvedValue(makeMetric('agent', 90));
    const app = createCockpitEvaluationRoutes(svc as never);
    const res = await app.request('/evaluation/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimension: 'agent', score: 90 }),
    });
    expect(res.status).toBe(201);
    expect(svc.createMetric).toHaveBeenCalledWith({ dimension: 'agent', score: 90 });
  });

  it('GET /evaluation/scorecards 分页 + 序列化 overallScore', async () => {
    const svc = mockService();
    svc.listScorecards.mockResolvedValue({
      items: [makeScorecard([{ value: 80 }], 80)],
      total: 1,
      limit: 50,
      offset: 0,
    });
    const app = createCockpitEvaluationRoutes(svc as never);
    const res = await app.request('/evaluation/scorecards');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].overallScore).toBe(80);
  });

  it('POST /evaluation/scorecards 调 createScorecard + 201 + overallScore 序列化', async () => {
    const svc = mockService();
    svc.createScorecard.mockResolvedValue(makeScorecard([{ value: 80 }, { value: 60 }], 70));
    const app = createCockpitEvaluationRoutes(svc as never);
    const res = await app.request('/evaluation/scorecards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores: [{ value: 80 }, { value: 60 }] }),
    });
    expect(res.status).toBe(201);
    expect(svc.createScorecard).toHaveBeenCalledWith({ scores: [{ value: 80 }, { value: 60 }] });
    const body = await res.json();
    expect(body.overallScore).toBe(70);
  });

  it('GET /evaluation/scorecards/:id 找到 → 200', async () => {
    const svc = mockService();
    svc.getScorecard.mockResolvedValue(makeScorecard([], 0));
    const app = createCockpitEvaluationRoutes(svc as never);
    const res = await app.request('/evaluation/scorecards/sc1');
    expect(res.status).toBe(200);
  });

  it('GET /evaluation/scorecards/:id 不存在 → 404', async () => {
    const svc = mockService();
    svc.getScorecard.mockResolvedValue(null);
    const app = createCockpitEvaluationRoutes(svc as never);
    const res = await app.request('/evaluation/scorecards/x');
    expect(res.status).toBe(404);
  });

  it('GET /evaluation/dual-track 序列化双轨 summary + insights', async () => {
    const svc = mockService();
    svc.dualTrack.mockResolvedValue({
      humanTrack: { metrics: [makeMetric('human', 70)], avgScore: 70 },
      agentTrack: { metrics: [makeMetric('agent', 85)], avgScore: 85 },
      comparisonInsights: ['洞察1'],
    });
    const app = createCockpitEvaluationRoutes(svc as never);
    const res = await app.request('/evaluation/dual-track');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.humanTrack.summary.avgScore).toBe(70);
    expect(body.agentTrack.summary.avgScore).toBe(85);
    expect(body.humanTrack.metrics[0].createdAt).toBe(fixedDate.getTime());
    expect(body.comparisonInsights).toEqual(['洞察1']);
  });

  it('GET /evaluation/trends 透传 period + 序列化 dataPoints', async () => {
    const svc = mockService();
    svc.trends.mockResolvedValue({ period: '7d', dataPoints: [makeMetric('human', 60)] });
    const app = createCockpitEvaluationRoutes(svc as never);
    const res = await app.request('/evaluation/trends?period=7d');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('7d');
    expect(body.dataPoints[0].createdAt).toBe(fixedDate.getTime());
  });

  it('GET /evaluation/trends 默认 period=7d', async () => {
    const svc = mockService();
    svc.trends.mockResolvedValue({ period: '7d', dataPoints: [] });
    const app = createCockpitEvaluationRoutes(svc as never);
    await app.request('/evaluation/trends');
    expect(svc.trends).toHaveBeenCalledWith('7d');
  });
});
