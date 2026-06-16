import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { KnowledgeService } from '../../contexts/knowledge/knowledge-service.js';

export function createKnowledgeRoutes(knowledgeService: KnowledgeService) {
  const app = new Hono();

  /* ---- Knowledge Base CRUD ---- */

  app.get('/bases', async (c) => {
    const tenantId = c.req.query('tenantId');
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const bases = await knowledgeService.listKnowledgeBases(tenantId);
    return c.json({ success: true, data: bases, total: bases.length });
  });

  app.get('/bases/:id', async (c) => {
    const kb = await knowledgeService.getKnowledgeBase(c.req.param('id'));
    return c.json({ success: true, data: kb });
  });

  app.post('/bases', async (c) => {
    const body = await c.req.json();
    if (!body.tenantId) return c.json({ error: 'tenantId required' }, 400);
    if (!body.name) return c.json({ error: 'name required' }, 400);
    const kb = await knowledgeService.createKnowledgeBase(body);
    return c.json({ success: true, data: kb }, 201);
  });

  app.put('/bases/:id', async (c) => {
    const body = await c.req.json();
    const kb = await knowledgeService.updateKnowledgeBase(c.req.param('id'), body);
    return c.json({ success: true, data: kb });
  });

  app.delete('/bases/:id', async (c) => {
    const kb = await knowledgeService.archiveKnowledgeBase(c.req.param('id'));
    return c.json({ success: true, data: kb });
  });

  /* ---- Instance Binding ---- */

  app.post('/bases/:id/bind-instances', async (c) => {
    const { instanceIds } = await c.req.json();
    if (!Array.isArray(instanceIds)) return c.json({ error: 'instanceIds must be array' }, 400);
    const kb = await knowledgeService.bindToInstances(c.req.param('id'), instanceIds);
    return c.json({ success: true, data: kb });
  });

  app.post('/bases/:id/unbind-instances', async (c) => {
    const { instanceIds } = await c.req.json();
    if (!Array.isArray(instanceIds)) return c.json({ error: 'instanceIds must be array' }, 400);
    const kb = await knowledgeService.unbindFromInstances(c.req.param('id'), instanceIds);
    return c.json({ success: true, data: kb });
  });

  /* ---- Document Sync ---- */

  app.post('/bases/:kbId/documents', async (c) => {
    const body = await c.req.json();
    if (!body.tenantId) return c.json({ error: 'tenantId required' }, 400);
    if (!body.title) return c.json({ error: 'title required' }, 400);

    const kbId = c.req.param('kbId');
    if (body.url) {
      const entry = await knowledgeService.syncDocumentByUrl(body.tenantId, kbId, {
        url: body.url,
        metadata: body.metadata,
      });
      return c.json({ success: true, data: entry }, 201);
    }

    if (!body.content) return c.json({ error: 'content or url required' }, 400);
    const entry = await knowledgeService.syncDocument(body.tenantId, kbId, {
      id: body.documentId || body.id || '',
      title: body.title,
      content: body.content,
      type: body.type,
    });
    return c.json({ success: true, data: entry }, 201);
  });

  /* ---- RAG Query ---- */

  app.post('/query', async (c) => {
    const body = await c.req.json();
    if (!body.tenantId) return c.json({ error: 'tenantId required' }, 400);
    if (!body.query) return c.json({ error: 'query required' }, 400);

    const result = await knowledgeService.query(body.tenantId, body.query, body.knowledgeBaseIds);
    return c.json({ success: true, data: result });
  });

  app.post('/query/stream', async (c) => {
    const body = await c.req.json();
    if (!body.tenantId) return c.json({ error: 'tenantId required' }, 400);
    if (!body.query) return c.json({ error: 'query required' }, 400);

    const upstream = await knowledgeService.queryStream(
      body.tenantId,
      body.query,
      body.knowledgeBaseIds
    );

    if (!upstream.body) return c.json({ error: 'no stream available' }, 502);

    return stream(c, async (s) => {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await s.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }
    });
  });

  app.post('/agent-query', async (c) => {
    const body = await c.req.json();
    if (!body.tenantId) return c.json({ error: 'tenantId required' }, 400);
    if (!body.query) return c.json({ error: 'query required' }, 400);

    const upstream = await knowledgeService.agentQuery(
      body.tenantId,
      body.query,
      body.knowledgeBaseIds
    );

    if (!upstream.body) return c.json({ error: 'no stream available' }, 502);

    return stream(c, async (s) => {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await s.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }
    });
  });

  /* ---- Search ---- */

  app.post('/search', async (c) => {
    const body = await c.req.json();
    if (!body.tenantId) return c.json({ error: 'tenantId required' }, 400);
    if (!body.query) return c.json({ error: 'query required' }, 400);

    const hits = await knowledgeService.search(body.tenantId, body.query, body.knowledgeBaseIds, {
      topK: body.topK,
      scoreThreshold: body.scoreThreshold,
    });
    return c.json({ success: true, data: hits, total: hits.length });
  });

  /* ---- Tenant Provisioning (admin) ---- */

  app.post('/provision', async (c) => {
    const body = await c.req.json();
    if (!body.tenantId || !body.tenantSlug || !body.tenantName) {
      return c.json({ error: 'tenantId, tenantSlug, tenantName required' }, 400);
    }
    const mapping = await knowledgeService.provisionTenant(
      body.tenantId,
      body.tenantSlug,
      body.tenantName
    );
    return c.json({ success: true, data: { wkTenantId: mapping.wkTenantId } }, 201);
  });

  return app;
}
