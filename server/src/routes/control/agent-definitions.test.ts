import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createControlAgentDefinitionRoutes } from './agent-definitions.js';

function mockUser() {
  return { username: 'admin1', tenantId: 'tn_test', roles: ['platform_admin'] };
}

function withAuth(app: Hono) {
  const wrapper = new Hono();
  wrapper.use('*', async (c, next) => {
    c.set('user', mockUser());
    await next();
  });
  wrapper.route('/', app);
  return wrapper;
}

describe('control agent-definitions routes', () => {
  it('POST /:id/instantiate 调 instantiateExistingDefinition 返回 instanceId(D10)', async () => {
    const svc = {
      instantiateExistingDefinition: vi.fn().mockResolvedValue({
        agentDefinitionId: 'adef-1',
        instanceId: 'inst-1',
        name: '客服助手',
      }),
    };
    const app = withAuth(createControlAgentDefinitionRoutes(svc as never));
    const res = await app.request('/adef-1/instantiate', { method: 'POST' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ agentDefinitionId: 'adef-1', instanceId: 'inst-1', name: '客服助手' });
    // 用 auth principal 的 tenantId/username 调 service
    expect(svc.instantiateExistingDefinition).toHaveBeenCalledWith('adef-1', 'tn_test', 'admin1');
  });

  it('POST /:id/instantiate 服务抛错时返回 500', async () => {
    const svc = {
      instantiateExistingDefinition: vi.fn().mockRejectedValue(new Error('agent definition not found: adef-x')),
    };
    const app = withAuth(createControlAgentDefinitionRoutes(svc as never));
    const res = await app.request('/adef-x/instantiate', { method: 'POST' });
    expect(res.status).toBe(500);
  });

  it('POST /:id/instantiate 无 tenantId 时降级 default', async () => {
    const svc = {
      instantiateExistingDefinition: vi.fn().mockResolvedValue({
        agentDefinitionId: 'adef-1',
        instanceId: 'inst-1',
        name: 'A',
      }),
    };
    const wrapper = new Hono();
    wrapper.use('*', async (c, next) => {
      c.set('user', { username: 'u1', tenantId: undefined, roles: [] });
      await next();
    });
    wrapper.route('/', createControlAgentDefinitionRoutes(svc as never));
    const res = await wrapper.request('/adef-1/instantiate', { method: 'POST' });
    expect(res.status).toBe(201);
    expect(svc.instantiateExistingDefinition).toHaveBeenCalledWith('adef-1', 'default', 'u1');
  });
});
