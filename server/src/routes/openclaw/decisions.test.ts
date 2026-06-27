import { describe, it, expect, vi } from 'vitest';
import { createOpenclawDecisionRoutes } from './decisions.js';

function mockRepo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    listPaged: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    get: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

describe('openclaw decision routes', () => {
  it('GET /decisions returns decision list (default limit=50, no full return)', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([{ id: 'd-1', responseStatus: 'pending' }]);
    const app = createOpenclawDecisionRoutes(repo as never);
    const res = await app.request('/decisions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.limit).toBe(50); // §7.2.1:默认非空,不传参不全量返回
  });

  it('GET /decisions filters by status', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { id: 'd-1', responseStatus: 'pending' },
      { id: 'd-2', responseStatus: 'accepted' },
    ]);
    const app = createOpenclawDecisionRoutes(repo as never);
    const res = await app.request('/decisions?status=pending');
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('GET /decisions supports limit pagination (list+slice, not listPaged — filter path)', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([{ id: 'd-1', responseStatus: 'pending' }]);
    const app = createOpenclawDecisionRoutes(repo as never);
    const res = await app.request('/decisions?limit=10&offset=0');
    expect(res.status).toBe(200);
    // 带 status filter 的端点走 list+filter+slice(listPaged 不支持 where filter)
    expect(repo.list).toHaveBeenCalledWith('decision');
    const body = await res.json();
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it('POST /decisions/:id/respond returns 404 when not found', async () => {
    const repo = mockRepo();
    const app = createOpenclawDecisionRoutes(repo as never);
    const res = await app.request('/decisions/d-999/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /decisions/:id/respond accepts decision', async () => {
    const repo = mockRepo();
    repo.get.mockResolvedValue({ id: 'd-1', responseStatus: 'pending' });
    const app = createOpenclawDecisionRoutes(repo as never);
    const res = await app.request('/decisions/d-1/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.responseStatus).toBe('accepted');
  });

  it('GET /inbox returns inbox data', async () => {
    const repo = mockRepo();
    repo.list.mockImplementation((type: string) => {
      if (type === 'workorder') return Promise.resolve([{ status: 'pending' }, { status: 'done' }]);
      if (type === 'goal') return Promise.resolve([{ id: 'g-1' }]);
      return Promise.resolve([]);
    });
    const app = createOpenclawDecisionRoutes(repo as never);
    const res = await app.request('/inbox');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalCount).toBe(1);
    expect(body.pendingCount).toBe(1);
  });

  it('GET /judgment-analytics returns aggregated stats', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([
      { outcome: 'correct', responseMs: 200, source: 'ai' },
      { outcome: 'incorrect', responseMs: 500, source: 'human' },
    ]);
    const app = createOpenclawDecisionRoutes(repo as never);
    const res = await app.request('/judgment-analytics');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalJudgments).toBe(2);
    expect(body.accuracyRate).toBe(0.5);
  });
});
