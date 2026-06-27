import { Hono } from 'hono';
import { newId } from '../../shared/utils.js';
import type { OpenclawRepository } from '../../db/repositories/openclaw-repository.js';
import { filteredResponse, pagedResponse } from './pagination.js';

export function createOpenclawEvaluationRoutes(repo: OpenclawRepository) {
  const app = new Hono();

  app.get('/evaluation/metrics', async (c) => {
    const dimension = c.req.query('dimension');
    return c.json(
      await filteredResponse(
        repo,
        'evaluation_metric',
        (k) => c.req.query(k),
        (items) => (dimension ? items.filter((m) => m.dimension === dimension) : items)
      )
    );
  });

  app.post('/evaluation/metrics', async (c) => {
    const body = await c.req.json();
    const metric = {
      id: newId('evm'),
      ...body,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await repo.upsert('evaluation_metric', metric.id, metric);
    return c.json(metric, 201);
  });

  app.get('/evaluation/scorecards', async (c) => {
    return c.json(await pagedResponse(repo, 'scorecard', (k) => c.req.query(k)));
  });

  app.post('/evaluation/scorecards', async (c) => {
    const body = await c.req.json();
    const scorecard = {
      id: newId('sc'),
      ...body,
      scores: body.scores ?? [],
      overallScore: 0,
      createdAt: Date.now(),
    };
    if (scorecard.scores.length > 0) {
      const total = scorecard.scores.reduce(
        (sum: number, s: { value: number }) => sum + s.value,
        0
      );
      scorecard.overallScore = Math.round(total / scorecard.scores.length);
    }
    await repo.upsert('scorecard', scorecard.id, scorecard);
    return c.json(scorecard, 201);
  });

  app.get('/evaluation/scorecards/:id', async (c) => {
    const item = await repo.get('scorecard', c.req.param('id'));
    if (!item) return c.json({ error: 'scorecard not found' }, 404);
    return c.json(item);
  });

  app.get('/evaluation/dual-track', async (c) => {
    const agentMetrics = await repo.list('evaluation_metric');
    const humanMetrics = agentMetrics.filter((m) => m.dimension === 'human');
    const aiMetrics = agentMetrics.filter((m) => m.dimension === 'agent');

    return c.json({
      humanTrack: {
        metrics: humanMetrics,
        summary: { avgScore: avg(humanMetrics.map((m) => (m.score as number) ?? 0)) },
      },
      agentTrack: {
        metrics: aiMetrics,
        summary: { avgScore: avg(aiMetrics.map((m) => (m.score as number) ?? 0)) },
      },
      comparisonInsights: generateInsights(humanMetrics, aiMetrics),
    });
  });

  app.get('/evaluation/trends', async (c) => {
    const period = c.req.query('period') ?? '7d';
    const items = await repo.list('evaluation_metric');
    const sorted = items.sort(
      (a, b) => ((a.createdAt as number) ?? 0) - ((b.createdAt as number) ?? 0)
    );
    return c.json({ period, dataPoints: sorted.slice(-50) });
  });

  return app;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function generateInsights(
  humanMetrics: Array<Record<string, unknown>>,
  aiMetrics: Array<Record<string, unknown>>
): string[] {
  const insights: string[] = [];
  const humanAvg = avg(humanMetrics.map((m) => (m.score as number) ?? 0));
  const aiAvg = avg(aiMetrics.map((m) => (m.score as number) ?? 0));

  if (aiAvg > humanAvg) {
    insights.push('Agent 执行效率高于人工处理平均水平');
  } else if (humanAvg > aiAvg) {
    insights.push('人工决策质量当前优于 Agent 自动处理');
  }

  if (humanMetrics.length > 0 && aiMetrics.length > 0) {
    insights.push(`评估周期内共 ${humanMetrics.length + aiMetrics.length} 项指标记录`);
  }

  return insights;
}
