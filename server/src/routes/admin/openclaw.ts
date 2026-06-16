import { Hono } from 'hono';
import type { AnalyticsService, DateRange } from '../../contexts/analytics/analytics-service.js';

function parseDateRange(c: {
  req: { query(k: string): string | undefined };
}): DateRange | undefined {
  const startStr = c.req.query('startDate');
  const endStr = c.req.query('endDate');
  if (!startStr || !endStr) return undefined;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
  return { start, end };
}

export function createAdminOpenclawRoutes(analyticsSvc: AnalyticsService) {
  const app = new Hono();

  /* ──── Monitor ──── */

  app.get('/monitor/cost', async (c) => {
    return c.json(await analyticsSvc.getCostSummary());
  });

  app.get('/monitor/sla', async (c) => {
    return c.json(await analyticsSvc.getSlaMetrics());
  });

  app.get('/monitor/alerts', async (c) => {
    return c.json(await analyticsSvc.getMonitorAlerts());
  });

  app.get('/monitor/performance', async (c) => {
    return c.json(await analyticsSvc.getPerformanceSummary());
  });

  /* ──── Statistics ──── */

  app.get('/statistics/dau', async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    const dateRange = parseDateRange(c);
    return c.json(await analyticsSvc.getDauTrend(days, dateRange));
  });

  app.get('/statistics/messages', async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    const dateRange = parseDateRange(c);
    return c.json(await analyticsSvc.getMessagesTrend(days, dateRange));
  });

  app.get('/statistics/retention', async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    const dateRange = parseDateRange(c);
    return c.json(await analyticsSvc.getRetentionTrend(days, dateRange));
  });

  app.get('/statistics/tokens', async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    const dateRange = parseDateRange(c);
    return c.json(await analyticsSvc.getTokensTrend(days, dateRange));
  });

  app.get('/statistics/dept-tokens', async (c) => {
    return c.json(await analyticsSvc.getDeptTokens());
  });

  app.get('/statistics/top-users', async (c) => {
    const limit = parseInt(c.req.query('limit') || '10', 10);
    return c.json(await analyticsSvc.getTopUsers(limit));
  });

  app.get('/statistics/top-user-spend', async (c) => {
    const limit = parseInt(c.req.query('limit') || '20', 10);
    return c.json(await analyticsSvc.getTopUserSpend(limit));
  });

  app.get('/statistics/latency', async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    return c.json(await analyticsSvc.getLatencyPercentiles(days));
  });

  app.get('/statistics/error-rate', async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    return c.json(await analyticsSvc.getErrorRateTrend(days));
  });

  app.get('/statistics/user-analysis', async (c) => {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    if (!startDate || !endDate) {
      return c.json({ error: 'startDate and endDate are required' }, 400);
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return c.json({ error: 'Invalid date format' }, 400);
    }
    const department = c.req.query('department') || undefined;
    const userId = c.req.query('userId') || undefined;
    const limit = parseInt(c.req.query('limit') || '50', 10);
    return c.json(
      await analyticsSvc.getUserAnalysis({
        startDate: start,
        endDate: end,
        department,
        userId,
        limit,
      })
    );
  });

  return app;
}
