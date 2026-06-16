import { Hono } from 'hono';
import { newId } from '../../shared/utils.js';

const memCategories = new Map<string, Record<string, unknown>>();

export function createCategoryRoutes() {
  const app = new Hono();

  app.get('/', (c) => {
    return c.json({ categories: [...memCategories.values()] });
  });

  app.get('/:id', (c) => {
    const cat = memCategories.get(c.req.param('id'));
    if (!cat) return c.json({ error: 'category not found' }, 404);
    return c.json({ category: cat });
  });

  app.post('/', async (c) => {
    const body = await c.req.json();
    const cat = { id: newId('cat'), ...body, documentCount: 0, createdAt: Date.now() };
    memCategories.set(cat.id, cat);
    return c.json({ category: cat }, 201);
  });

  app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json();
    const cat = memCategories.get(id);
    if (!cat) return c.json({ error: 'category not found' }, 404);
    Object.assign(cat, patch);
    return c.json({ category: cat });
  });

  app.delete('/:id', (c) => {
    memCategories.delete(c.req.param('id'));
    return c.json({ success: true });
  });

  return app;
}
