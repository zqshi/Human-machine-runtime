import { describe, it, expect, vi } from 'vitest';
import { createOpenclawCollaborationRoutes } from './collaboration.js';

function mockRepo() {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe('openclaw collaboration routes', () => {
  it('GET /intents returns intent list', async () => {
    const repo = mockRepo();
    repo.list.mockResolvedValue([{ id: 'int-1', type: 'request' }]);
    const app = createOpenclawCollaborationRoutes(repo as never);
    const res = await app.request('/intents');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(repo.list).toHaveBeenCalledWith('intent');
  });

  it('POST /intents creates intent', async () => {
    const repo = mockRepo();
    const app = createOpenclawCollaborationRoutes(repo as never);
    const res = await app.request('/intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'request' }),
    });
    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalledWith('intent', expect.any(String), expect.any(Object));
  });

  it('GET /sessions returns session list', async () => {
    const repo = mockRepo();
    const app = createOpenclawCollaborationRoutes(repo as never);
    const res = await app.request('/sessions');
    expect(res.status).toBe(200);
    expect(repo.list).toHaveBeenCalledWith('collab_session');
  });

  it('POST /sessions creates session', async () => {
    const repo = mockRepo();
    const app = createOpenclawCollaborationRoutes(repo as never);
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'test', participantIds: ['a1'] }),
    });
    expect(res.status).toBe(201);
  });

  it('GET /sessions/:id returns 404 when not found', async () => {
    const repo = mockRepo();
    const app = createOpenclawCollaborationRoutes(repo as never);
    const res = await app.request('/sessions/sess-999');
    expect(res.status).toBe(404);
  });

  it('GET /agent-profiles returns profiles', async () => {
    const repo = mockRepo();
    const app = createOpenclawCollaborationRoutes(repo as never);
    const res = await app.request('/agent-profiles');
    expect(res.status).toBe(200);
    expect(repo.list).toHaveBeenCalledWith('agent_profile');
  });

  it('GET /agent-profiles/:id returns default when not found', async () => {
    const repo = mockRepo();
    const app = createOpenclawCollaborationRoutes(repo as never);
    const res = await app.request('/agent-profiles/agent-x');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agentId).toBe('agent-x');
    expect(body.totalCompleted).toBe(0);
  });

  it('POST /contracts creates contract', async () => {
    const repo = mockRepo();
    const app = createOpenclawCollaborationRoutes(repo as never);
    const res = await app.request('/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sla', terms: {} }),
    });
    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalledWith('contract', expect.any(String), expect.any(Object));
  });
});
