import { describe, it, expect, vi } from 'vitest';
import { createOpenclawTaskRoutes } from './tasks.js';

function mockRepo() {
  const store = new Map<string, Record<string, unknown>[]>();
  return {
    list: vi.fn(async (type: string) => store.get(type) ?? []),
    listPaged: vi.fn(async (type: string, opts?: { limit?: number; offset?: number }) => {
      const items = store.get(type) ?? [];
      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;
      return {
        items: items.slice(offset, offset + limit),
        total: items.length,
        limit,
        offset,
      };
    }),
    get: vi.fn(async (type: string, id: string) => {
      const items = store.get(type) ?? [];
      return items.find((i) => i.id === id) ?? null;
    }),
    upsert: vi.fn(async (type: string, id: string, data: Record<string, unknown>) => {
      const items = store.get(type) ?? [];
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) items[idx] = data;
      else items.push({ id, ...data });
      store.set(type, items);
    }),
    remove: vi.fn(async () => true),
    _store: store,
  } as never;
}

describe('openclaw task routes', () => {
  describe('GET /tasks', () => {
    it('returns empty task list', async () => {
      const repo = mockRepo();
      const app = createOpenclawTaskRoutes(repo);
      const res = await app.request('/tasks');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
    });

    it('supports pagination via query params', async () => {
      const repo = mockRepo();
      const app = createOpenclawTaskRoutes(repo);
      const res = await app.request('/tasks?limit=10&offset=0');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(0);
      expect(body.total).toBe(0);
    });
  });

  describe('POST /goals', () => {
    it('creates a goal successfully', async () => {
      const repo = mockRepo();
      const app = createOpenclawTaskRoutes(repo);
      const res = await app.request('/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Goal', description: 'A test goal' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.status).toBe('active');
    });
  });

  describe('POST /workorders', () => {
    it('creates a work order successfully', async () => {
      const repo = mockRepo();
      const app = createOpenclawTaskRoutes(repo);
      const res = await app.request('/workorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test WO', content: 'Review this' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.status).toBe('pending');
    });
  });

  describe('GET /workorders', () => {
    it('returns workorder list', async () => {
      const repo = mockRepo();
      const app = createOpenclawTaskRoutes(repo);
      const res = await app.request('/workorders');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
    });
  });
});
