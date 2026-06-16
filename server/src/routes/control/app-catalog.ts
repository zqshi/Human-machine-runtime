import { Hono } from 'hono';
import type { AppCatalogRepository } from '../../db/repositories/app-catalog-repository.js';

export function createAppCatalogRoutes(repo: AppCatalogRepository) {
  const app = new Hono();

  app.get('/', async (c) => {
    const category = c.req.query('category');
    const items = await repo.list(category || undefined);
    const grouped: Record<string, typeof items> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
    return c.json({ items, grouped });
  });

  app.get('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const item = await repo.get(id);
    if (!item) return c.json({ error: 'app not found' }, 404);
    return c.json({ item });
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const item = await repo.create({
      name: body.name,
      icon: body.icon,
      iconColor: body.iconColor || '#007AFF',
      category: body.category,
      description: body.description || null,
      status: body.status || 'active',
      sortOrder: body.sortOrder || 0,
      visible: body.visible !== false,
      tenantId: body.tenantId || null,
    });
    return c.json({ item }, 201);
  });

  app.put('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    const item = await repo.update(id, body);
    if (!item) return c.json({ error: 'app not found' }, 404);
    return c.json({ item });
  });

  app.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const deleted = await repo.delete(id);
    if (!deleted) return c.json({ error: 'app not found' }, 404);
    return c.json({ success: true });
  });

  return app;
}
