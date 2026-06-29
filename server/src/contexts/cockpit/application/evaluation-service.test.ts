import { describe, it, expect, vi } from 'vitest';
import { EvaluationService } from './evaluation-service.js';
import { EvaluationMetric } from '../domain/evaluation/evaluation-metric.js';
import { Scorecard } from '../domain/evaluation/scorecard.js';

function mockDeps() {
  const metricRepo = { listPaged: vi.fn(), list: vi.fn(), findById: vi.fn(), save: vi.fn() };
  const scorecardRepo = { listPaged: vi.fn(), findById: vi.fn(), save: vi.fn() };
  const insightsPort = vi.fn();
  const service = new EvaluationService(
    metricRepo as never,
    scorecardRepo as never,
    insightsPort as never
  );
  return { service, metricRepo, scorecardRepo, insightsPort };
}

const fixedDate = new Date('2026-01-01T00:00:00Z');

function makeMetric(id: string, dimension: 'human' | 'agent', score: number, createdAt: number) {
  return EvaluationMetric.fromProps({
    id,
    dimension,
    score,
    metadata: {},
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  });
}

describe('EvaluationService', () => {
  it('createMetric 调 domain.create + repo.save（不注入 eventBus，原 route 不发事件）', async () => {
    const { service, metricRepo } = mockDeps();
    const m = await service.createMetric({ dimension: 'agent', score: 90 });
    expect(m).toBeInstanceOf(EvaluationMetric);
    expect(metricRepo.save).toHaveBeenCalledWith(m);
  });

  it('listMetrics 透传 listPaged opts', async () => {
    const { service, metricRepo } = mockDeps();
    metricRepo.listPaged.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    await service.listMetrics({ dimension: 'human', limit: 10 });
    expect(metricRepo.listPaged).toHaveBeenCalledWith({ dimension: 'human', limit: 10 });
  });

  it('createScorecard domain 算 overallScore + repo.save', async () => {
    const { service, scorecardRepo } = mockDeps();
    const s = await service.createScorecard({ scores: [{ value: 80 }, { value: 60 }] });
    expect(s).toBeInstanceOf(Scorecard);
    expect(s.overallScore).toBe(70);
    expect(scorecardRepo.save).toHaveBeenCalledWith(s);
  });

  it('listScorecards 透传 listPaged opts', async () => {
    const { service, scorecardRepo } = mockDeps();
    scorecardRepo.listPaged.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    await service.listScorecards({ tenantId: 't1' });
    expect(scorecardRepo.listPaged).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  it('getScorecard 透传 findById', async () => {
    const { service, scorecardRepo } = mockDeps();
    scorecardRepo.findById.mockResolvedValue(null);
    expect(await service.getScorecard('x')).toBeNull();
    expect(scorecardRepo.findById).toHaveBeenCalledWith('x');
  });

  describe('dualTrack', () => {
    it('分轨 human/agent + 调 insightsPort + summary avgScore', async () => {
      const { service, metricRepo, insightsPort } = mockDeps();
      metricRepo.list.mockResolvedValue([
        makeMetric('m1', 'human', 70, 100),
        makeMetric('m2', 'agent', 85, 200),
        makeMetric('m3', 'human', 80, 300),
      ]);
      insightsPort.mockResolvedValue(['Agent 效率高', '人工质量稳']);
      const r = await service.dualTrack();
      expect(r.humanTrack.metrics).toHaveLength(2);
      expect(r.agentTrack.metrics).toHaveLength(1);
      expect(r.humanTrack.avgScore).toBe(75); // (70+80)/2
      expect(r.agentTrack.avgScore).toBe(85);
      expect(r.comparisonInsights).toEqual(['Agent 效率高', '人工质量稳']);
      expect(insightsPort).toHaveBeenCalledOnce();
    });

    it('port=null → comparisonInsights=[]（增强字段不 503，对齐原 route 行为）', async () => {
      const { metricRepo, scorecardRepo } = mockDeps();
      const service = new EvaluationService(metricRepo as never, scorecardRepo as never, null);
      metricRepo.list.mockResolvedValue([makeMetric('m1', 'human', 70, 100)]);
      const r = await service.dualTrack();
      expect(r.humanTrack.avgScore).toBe(70);
      expect(r.comparisonInsights).toEqual([]);
    });

    it('空 metrics → 双轨均空 + avgScore 0 + port 仍调用（generateInsights 内部短路返 []）', async () => {
      const { service, metricRepo, insightsPort } = mockDeps();
      metricRepo.list.mockResolvedValue([]);
      insightsPort.mockResolvedValue([]);
      const r = await service.dualTrack();
      expect(r.humanTrack.metrics).toHaveLength(0);
      expect(r.agentTrack.metrics).toHaveLength(0);
      expect(r.humanTrack.avgScore).toBe(0);
      // port 总被调用（无数据时 generateInsights 内部返 []，service 不预判短路）
      expect(insightsPort).toHaveBeenCalledOnce();
    });
  });

  describe('trends', () => {
    it('按 createdAt 升序 + period echo', async () => {
      const { service, metricRepo } = mockDeps();
      metricRepo.list.mockResolvedValue([
        makeMetric('m1', 'human', 60, 200),
        makeMetric('m2', 'human', 50, 100),
      ]);
      const r = await service.trends('7d');
      expect(r.period).toBe('7d');
      expect(r.dataPoints).toHaveLength(2);
      expect(r.dataPoints[0].id).toBe('m2'); // createdAt 100 在前
      expect(r.dataPoints[1].id).toBe('m1');
    });

    it('超过 50 条 slice(-50) 取最近 50', async () => {
      const { service, metricRepo } = mockDeps();
      const metrics = Array.from({ length: 60 }, (_, i) => makeMetric(`m${i}`, 'human', i, i * 10));
      metricRepo.list.mockResolvedValue(metrics);
      const r = await service.trends('7d');
      expect(r.dataPoints).toHaveLength(50);
      // slice(-50) = 最近的 50 条（升序），即 m10..m59
      expect(r.dataPoints[0].id).toBe('m10');
      expect(r.dataPoints[49].id).toBe('m59');
    });
  });
});
