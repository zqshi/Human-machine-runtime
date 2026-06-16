import { describe, it, expect, vi } from 'vitest';
import { createAppCatalogRoutes } from './app-catalog.js';

function mockRepo() {
  return {
    list: vi.fn().mockResolvedValue([
      { id: 1, name: 'ChatBot', category: 'ai', icon: 'bot', iconColor: '#007AFF' },
      { id: 2, name: 'DocGen', category: 'tools', icon: 'file', iconColor: '#34C759' },
    ]),
    get: vi.fn().mockImplementation((id: number) => {
      if (id === 1) return Promise.resolve({ id: 1, name: 'ChatBot', category: 'ai' });
      return Promise.resolve(null);
    }),
    create: vi.fn().mockResolvedValue({ id: 3, name: 'NewApp', category: 'ai' }),
    update: vi.fn().mockImplementation((id: number, body: unknown) => {
      if (id === 1) return Promise.resolve({ id: 1, ...body });
      return Promise.resolve(null);
    }),
    delete: vi.fn().mockImplementation((id: number) => {
      return Promise.resolve(id === 1);
    }),
  };
}

describe('control app-catalog routes', () => {
  it('GET / returns items grouped by category', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.grouped.ai).toHaveLength(1);
    expect(body.grouped.tools).toHaveLength(1);
  });

  it('GET / filters by category query param', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    await app.request('/?category=ai');
    expect(repo.list).toHaveBeenCalledWith('ai');
  });

  it('GET /:id returns item', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    const res = await app.request('/1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.name).toBe('ChatBot');
  });

  it('GET /:id returns 404 for non-existent', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    const res = await app.request('/999');
    expect(res.status).toBe(404);
  });

  it('POST / creates a new app', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NewApp', icon: 'star', category: 'ai' }),
    });
    expect(res.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'NewApp', icon: 'star', category: 'ai' })
    );
  });

  it('PUT /:id updates an app', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    const res = await app.request('/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(200);
  });

  it('PUT /:id returns 404 for non-existent', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    const res = await app.request('/999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes an app', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    const res = await app.request('/1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('DELETE /:id returns 404 for non-existent', async () => {
    const repo = mockRepo();
    const app = createAppCatalogRoutes(repo as never);
    const res = await app.request('/999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
