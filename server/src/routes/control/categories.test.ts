import { describe, it, expect } from 'vitest';
import { createCategoryRoutes } from './categories.js';

describe('control category routes', () => {
  it('GET / returns empty initially', async () => {
    const app = createCategoryRoutes();
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categories).toBeDefined();
  });

  it('POST / creates category and GET /:id retrieves it', async () => {
    const app = createCategoryRoutes();
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Finance', description: 'Finance docs' }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.category.name).toBe('Finance');

    const getRes = await app.request(`/${created.category.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.category.name).toBe('Finance');
  });

  it('GET /:id returns 404 when not found', async () => {
    const app = createCategoryRoutes();
    const res = await app.request('/cat-nonexistent');
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes category', async () => {
    const app = createCategoryRoutes();
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Temp' }),
    });
    const { category } = await createRes.json();

    const delRes = await app.request(`/${category.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);

    const getRes = await app.request(`/${category.id}`);
    expect(getRes.status).toBe(404);
  });
});
