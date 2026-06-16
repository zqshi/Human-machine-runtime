import { describe, it, expect, vi } from 'vitest';
import { createAdminSharedAgentRoutes } from './shared-agents.js';

function mockSharedAgentSvc() {
  return {
    listAll: vi.fn().mockResolvedValue({ agents: [{ id: 'a-1', name: 'Helper' }] }),
    recommend: vi.fn().mockResolvedValue({ agents: [] }),
    register: vi.fn().mockResolvedValue({ id: 'a-2' }),
    unregister: vi.fn().mockResolvedValue(true),
  };
}

describe('admin shared-agent routes', () => {
  it('GET / returns all shared agents', async () => {
    const svc = mockSharedAgentSvc();
    const app = createAdminSharedAgentRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
  });

  it('POST /recommend returns recommendations', async () => {
    const svc = mockSharedAgentSvc();
    const app = createAdminSharedAgentRoutes(svc as never);
    const res = await app.request('/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirement: 'data analysis' }),
    });
    expect(res.status).toBe(200);
    expect(svc.recommend).toHaveBeenCalledWith('data analysis');
  });

  it('POST /register creates shared agent', async () => {
    const svc = mockSharedAgentSvc();
    const app = createAdminSharedAgentRoutes(svc as never);
    const res = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Analyzer', description: 'Analyzes data' }),
    });
    expect(res.status).toBe(201);
    expect(svc.register).toHaveBeenCalled();
  });

  it('POST /register returns 400 for invalid body', async () => {
    const svc = mockSharedAgentSvc();
    const app = createAdminSharedAgentRoutes(svc as never);
    const res = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /:id unregisters agent', async () => {
    const svc = mockSharedAgentSvc();
    const app = createAdminSharedAgentRoutes(svc as never);
    const res = await app.request('/a-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(svc.unregister).toHaveBeenCalledWith('a-1');
  });
});
