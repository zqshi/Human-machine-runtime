import { describe, it, expect, vi } from 'vitest';
import { createCockpitObjectiveRoutes } from './objectives.js';

function mockRepo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe('cockpit objective routes', () => {
  it('GET / returns objectives', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([{ id: 'obj-1', level: 'L0', title: 'Goal' }]);
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('GET / filters by level', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { id: 'obj-1', level: 'L0' },
      { id: 'obj-2', level: 'L1' },
    ]);
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/?level=L0');
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].level).toBe('L0');
  });

  it('POST / creates objective', async () => {
    const repo = mockRepo();
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Goal', level: 'L0' }),
    });
    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalled();
  });

  it('GET /:id returns 404 when not found', async () => {
    const repo = mockRepo();
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/obj-999');
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes objective', async () => {
    const repo = mockRepo();
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/obj-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(repo.remove).toHaveBeenCalledWith('objective', 'obj-1');
  });

  it('POST /decode returns structured analysis', async () => {
    const repo = mockRepo();
    const app = createCockpitObjectiveRoutes(repo as never);
    const res = await app.request('/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: '提高客户满意度' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toBeDefined();
    expect(body.hypotheses).toBeDefined();
  });
});
