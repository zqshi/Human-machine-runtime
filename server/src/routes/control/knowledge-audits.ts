import { Hono } from 'hono';
import type { DocumentService } from '../../contexts/document/document-service.js';

export function createKnowledgeAuditRoutes(docSvc: DocumentService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const filters = {
      operationType: c.req.query('operationType') || undefined,
      operatorId: c.req.query('operatorId') || undefined,
      targetId: c.req.query('targetId') || undefined,
    };
    const rows = await docSvc.listKnowledgeAudits(filters);
    return c.json({ items: rows, total: rows.length });
  });

  return app;
}
