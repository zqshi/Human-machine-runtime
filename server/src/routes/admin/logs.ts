import { Hono } from 'hono';
import type { AuditService } from '../../contexts/audit-observability/audit-service.js';

export function createAdminLogRoutes(svc: AuditService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const scope = c.req.query('scope');
    const mod = c.req.query('module');
    const operation = c.req.query('operation');
    const actor = c.req.query('actor');
    const timeRange = c.req.query('timeRange');
    const limit = c.req.query('limit');
    const filters: Record<string, string | undefined> = { type: scope || mod || operation, actor };
    if (timeRange) {
      const [from, to] = timeRange.split(',');
      if (from) filters.from = from;
      if (to) filters.to = to;
    }
    const rows = await svc.list(
      limit ? parseInt(limit, 10) : 200,
      filters as Parameters<typeof svc.list>[1]
    );
    return c.json(rows);
  });

  app.get('/export/csv', async (c) => {
    const result = await svc.export(1000, {}, 'ndjson');
    return c.text(result.body, 200, { 'Content-Type': 'text/csv; charset=utf-8' });
  });

  app.get('/export/json', async (c) => {
    const result = await svc.export(1000, {}, 'json');
    return c.text(result.body, 200, { 'Content-Type': 'application/json; charset=utf-8' });
  });

  return app;
}
