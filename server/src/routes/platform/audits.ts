import { Hono } from 'hono';
import { AuditService } from '../../contexts/audit-observability/audit-service.js';

export function createAuditRoutes(auditService: AuditService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const limit = Number(c.req.query('limit') || 100);
    const cursor = c.req.query('cursor') || 0;
    const filters = {
      type: c.req.query('type'),
      actor: c.req.query('actor'),
      tenantId: c.req.query('tenantId'),
      instanceId: c.req.query('instanceId'),
      from: c.req.query('from'),
      to: c.req.query('to'),
    };
    const page = await auditService.queryPage(limit, filters, cursor);
    return c.json({ success: true, data: page.rows, total: page.total });
  });

  app.get('/export', async (c) => {
    const limit = Number(c.req.query('limit') || 1000);
    const format = c.req.query('format') || 'json';
    const cursor = c.req.query('cursor') || 0;
    const filters = { type: c.req.query('type'), actor: c.req.query('actor') };
    const result = await auditService.export(limit, filters, format, cursor);
    return new Response(result.body, {
      headers: { 'Content-Type': result.contentType },
    });
  });

  return app;
}
