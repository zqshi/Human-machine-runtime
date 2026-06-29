import { Hono } from 'hono';
import type { EvaluationService } from '../../contexts/cockpit/application/evaluation-service.js';
import type {
  EvaluationMetric,
  EvaluationDimension,
} from '../../contexts/cockpit/domain/evaluation/evaluation-metric.js';
import type { Scorecard } from '../../contexts/cockpit/domain/evaluation/scorecard.js';

/**
 * cockpit 评估子系统路由（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 薄层：参数提取 → 调 EvaluationService → 返回。业务逻辑（CRUD/overallScore 计算/dual-track
 * 聚合/trends 排序）在 service。serialize Date→ms（同 decisions/orchestration route 契约）。
 * dual-track 的 LLM 洞察由 service 经 InsightsPort 注入（generateInsights 不动，防 scope creep）。
 */

function serializeMetric(m: EvaluationMetric) {
  const p = m.toProps();
  return {
    id: p.id,
    dimension: p.dimension,
    score: p.score,
    metadata: p.metadata,
    tenantId: p.tenantId,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  };
}

function serializeScorecard(s: Scorecard) {
  const p = s.toProps();
  return {
    id: p.id,
    scores: p.scores,
    overallScore: p.overallScore,
    metadata: p.metadata,
    tenantId: p.tenantId,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  };
}

function parsePagedQuery(q: (k: string) => string | undefined) {
  const limit = q('limit');
  const offset = q('offset');
  return {
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  };
}

export function createCockpitEvaluationRoutes(service: EvaluationService) {
  const app = new Hono();

  // ── metrics ──
  app.get('/evaluation/metrics', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listMetrics({
      dimension: q('dimension') as EvaluationDimension | undefined,
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializeMetric),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/evaluation/metrics', async (c) => {
    const body = await c.req.json();
    const m = await service.createMetric(body);
    return c.json(serializeMetric(m), 201);
  });

  // ── scorecards ──
  app.get('/evaluation/scorecards', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listScorecards({ tenantId: q('tenantId'), limit, offset });
    return c.json({
      items: result.items.map(serializeScorecard),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/evaluation/scorecards', async (c) => {
    const body = await c.req.json();
    const s = await service.createScorecard(body);
    return c.json(serializeScorecard(s), 201);
  });

  app.get('/evaluation/scorecards/:id', async (c) => {
    const s = await service.getScorecard(c.req.param('id'));
    if (!s) return c.json({ error: 'scorecard not found' }, 404);
    return c.json(serializeScorecard(s));
  });

  // ── 聚合查询 ──
  app.get('/evaluation/dual-track', async (c) => {
    const r = await service.dualTrack();
    return c.json({
      humanTrack: {
        metrics: r.humanTrack.metrics.map(serializeMetric),
        summary: { avgScore: r.humanTrack.avgScore },
      },
      agentTrack: {
        metrics: r.agentTrack.metrics.map(serializeMetric),
        summary: { avgScore: r.agentTrack.avgScore },
      },
      comparisonInsights: r.comparisonInsights,
    });
  });

  app.get('/evaluation/trends', async (c) => {
    const period = c.req.query('period') ?? '7d';
    const r = await service.trends(period);
    return c.json({
      period: r.period,
      dataPoints: r.dataPoints.map(serializeMetric),
    });
  });

  return app;
}
