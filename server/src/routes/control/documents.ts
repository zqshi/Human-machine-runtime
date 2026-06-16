import { Hono } from 'hono';
import { DocumentService } from '../../contexts/document/document-service.js';

export function createDocumentRoutes(documentService: DocumentService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const roomId = c.req.query('roomId');
    const filters = {
      folderId: c.req.query('folderId'),
      status: c.req.query('status'),
      categoryId: c.req.query('categoryId'),
      departmentId: c.req.query('departmentId'),
      ownerId: c.req.query('ownerId'),
      search: c.req.query('search'),
    };
    const docs = await documentService.list(roomId || undefined, filters);
    return c.json({ success: true, data: docs, total: docs.length });
  });

  app.get('/:id', async (c) => {
    const doc = await documentService.get(c.req.param('id'));
    return c.json({ success: true, data: doc });
  });

  app.post('/', async (c) => {
    const doc = await documentService.create(await c.req.json());
    return c.json({ success: true, data: doc }, 201);
  });

  app.put('/:id', async (c) => {
    const doc = await documentService.update(c.req.param('id'), await c.req.json());
    return c.json({ success: true, data: doc });
  });

  app.delete('/:id', async (c) => {
    const deleted = await documentService.delete(c.req.param('id'));
    return c.json({ success: true, deleted });
  });

  app.post('/:id/submit', async (c) => {
    const { actor } = await c.req.json().catch(() => ({ actor: {} }));
    const doc = await documentService.transitionStatus(c.req.param('id'), 'pending_review', actor);
    return c.json({ success: true, data: doc });
  });

  app.patch('/:id/star', async (c) => {
    const doc = await documentService.get(c.req.param('id'));
    const updated = await documentService.update(c.req.param('id'), {
      starred: !doc.content?.starred,
    });
    return c.json({ success: true, data: updated });
  });

  app.post('/:id/submit-review', async (c) => {
    const { actor } = await c.req.json().catch(() => ({ actor: {} }));
    const doc = await documentService.transitionStatus(c.req.param('id'), 'pending_review', actor);
    return c.json({ success: true, data: doc });
  });

  app.post('/:id/approve', async (c) => {
    const { actor } = await c.req.json().catch(() => ({ actor: {} }));
    const doc = await documentService.transitionStatus(c.req.param('id'), 'published', actor);
    return c.json({ success: true, data: doc });
  });

  app.post('/:id/reject', async (c) => {
    const { actor } = await c.req.json().catch(() => ({ actor: {} }));
    const doc = await documentService.transitionStatus(c.req.param('id'), 'rejected', actor);
    return c.json({ success: true, data: doc });
  });

  app.post('/:id/publish', async (c) => {
    const { actor } = await c.req.json().catch(() => ({ actor: {} }));
    const doc = await documentService.transitionStatus(c.req.param('id'), 'published', actor);
    return c.json({ success: true, data: doc });
  });

  app.post('/:id/archive', async (c) => {
    const { actor } = await c.req.json().catch(() => ({ actor: {} }));
    const doc = await documentService.transitionStatus(c.req.param('id'), 'archived', actor);
    return c.json({ success: true, data: doc });
  });

  app.get('/:id/versions', async (c) => {
    const versions = await documentService.listVersions(c.req.param('id'));
    return c.json({ success: true, data: versions });
  });

  app.post('/versions/:versionId/restore', async (c) => {
    const doc = await documentService.restoreVersion(c.req.param('versionId'));
    return c.json({ success: true, data: doc });
  });

  app.get('/:id/permissions', async (c) => {
    const doc = await documentService.get(c.req.param('id'));
    return c.json({ success: true, permissions: doc.permissions ?? [] });
  });

  app.put('/:id/permissions', async (c) => {
    const { permissions } = await c.req.json<{ permissions: unknown[] }>();
    const doc = await documentService.update(c.req.param('id'), { permissions });
    return c.json({ success: true, permissions: doc.permissions ?? [] });
  });

  return app;
}
