import { Hono } from 'hono';
import { newId } from '../../shared/utils.js';
import { appEventBus } from '../../shared/event-bus.js';
import type { CockpitRepository } from '../../db/repositories/cockpit-repository.js';
import { filteredResponse } from './pagination.js';

export function createCockpitDecisionRoutes(repo: CockpitRepository) {
  const app = new Hono();

  app.get('/decisions', async (c) => {
    const status = c.req.query('status');
    return c.json(
      await filteredResponse(
        repo,
        'decision',
        (k) => c.req.query(k),
        (items) => (status ? items.filter((d) => d.responseStatus === status) : items)
      )
    );
  });

  app.post('/decisions/:id/respond', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{
      action: string;
      feedback?: string;
      optionId?: string;
      deferUntil?: number;
    }>();
    const decision = await repo.get('decision', id);
    if (!decision) return c.json({ error: 'decision not found' }, 404);
    decision.responseStatus =
      body.action === 'accept'
        ? 'accepted'
        : body.action === 'decline'
          ? 'declined'
          : body.action === 'defer'
            ? 'deferred'
            : 'modified';
    decision.userResponse = body.feedback ?? body.optionId ?? body.action;
    decision.responseAt = Date.now();
    await repo.upsert('decision', id, decision);
    appEventBus.publish('decision:updated', decision as Record<string, unknown>);
    return c.json({ decision });
  });

  app.get('/inbox', async (c) => {
    const workorders = await repo.list('workorder');
    const goals = await repo.list('goal');
    const pendingWOs = workorders.filter((w) => w.status === 'pending').length;
    return c.json({ workOrders: workorders, goalCount: goals.length, pendingCount: pendingWOs });
  });

  app.get('/judgment-records', async (c) => {
    const decisionId = c.req.query('decisionId');
    return c.json(
      await filteredResponse(
        repo,
        'judgment_record',
        (k) => c.req.query(k),
        (items) => (decisionId ? items.filter((r) => r.decisionId === decisionId) : items)
      )
    );
  });

  app.post('/judgment-records', async (c) => {
    const body = await c.req.json();
    const record = {
      id: body.id || newId('jdg'),
      ...body,
      createdAt: body.createdAt ?? Date.now(),
    };
    await repo.upsert('judgment_record', record.id, record);
    return c.json(record, 201);
  });

  app.get('/judgment-analytics', async (c) => {
    const records = await repo.list('judgment_record');
    const total = records.length;
    const correct = records.filter((r) => r.outcome === 'correct').length;
    const latencies = records
      .map((r) => (typeof r.responseMs === 'number' ? r.responseMs : 0))
      .filter((v) => v > 0);
    const avgMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;
    const sources: Record<string, number> = {};
    for (const r of records) {
      const src = (r.source as string) || 'unknown';
      sources[src] = (sources[src] || 0) + 1;
    }
    return c.json({
      totalJudgments: total,
      accuracyRate: total > 0 ? Math.round((correct / total) * 100) / 100 : 0,
      avgResponseMs: avgMs,
      sourceDistribution: sources,
      timeSeriesData: [],
    });
  });

  return app;
}
