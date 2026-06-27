import { describe, it, expect, vi } from 'vitest';
import { createCockpitSignalRoutes } from './signals.js';

function mockRepo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    listPaged: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    get: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

describe('cockpit signal routes', () => {
  it('GET /signals returns signals', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([{ id: 's-1', urgency: 'high' }]);
    const app = createCockpitSignalRoutes(repo as never);
    const res = await app.request('/signals');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('GET /signals filters by urgency', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { id: 's-1', urgency: 'high' },
      { id: 's-2', urgency: 'low' },
    ]);
    const app = createCockpitSignalRoutes(repo as never);
    const res = await app.request('/signals?urgency=high');
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('GET /signals/emergent returns emergent signals (paged)', async () => {
    const repo = mockRepo();
    const app = createCockpitSignalRoutes(repo as never);
    const res = await app.request('/signals/emergent');
    expect(res.status).toBe(200);
    expect(repo.listPaged).toHaveBeenCalledWith('emergent_signal', { limit: 50, offset: 0 });
  });

  it('POST /signals/emergent creates signal', async () => {
    const repo = mockRepo();
    const app = createCockpitSignalRoutes(repo as never);
    const res = await app.request('/signals/emergent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'anomaly', description: 'spike' }),
    });
    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalledWith(
      'emergent_signal',
      expect.any(String),
      expect.any(Object)
    );
  });

  it('PATCH /signals/emergent/:id returns 404 when not found', async () => {
    const repo = mockRepo();
    const app = createCockpitSignalRoutes(repo as never);
    const res = await app.request('/signals/emergent/sig-999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /corrections/apply returns applied count', async () => {
    const repo = mockRepo();
    const app = createCockpitSignalRoutes(repo as never);
    const res = await app.request('/corrections/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'p-1', actions: [{ type: 'scale' }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(1);
  });

  it('GET /patterns returns patterns (paged)', async () => {
    const repo = mockRepo();
    const app = createCockpitSignalRoutes(repo as never);
    const res = await app.request('/patterns');
    expect(res.status).toBe(200);
    expect(repo.listPaged).toHaveBeenCalledWith('pattern', { limit: 50, offset: 0 });
  });
});
