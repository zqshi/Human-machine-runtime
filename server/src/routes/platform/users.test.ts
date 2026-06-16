import { describe, it, expect, vi } from 'vitest';
import { createPlatformUserRoutes } from './users.js';

function mockUserMgmtSvc() {
  return {
    listUsers: vi.fn().mockResolvedValue([
      { id: 1, username: 'admin', role: 'platform_admin', scope: 'platform', isActive: true },
      { id: 2, username: 'user1', role: 'tenant_admin', scope: 'admin', isActive: true },
    ]),
    createUser: vi.fn().mockResolvedValue({ id: 3, username: 'new_user' }),
    updateUser: vi.fn().mockResolvedValue({ id: 1, username: 'admin', role: 'updated' }),
    resetPassword: vi.fn().mockResolvedValue({ temporaryPassword: 'tmp123' }),
    toggleDisable: vi.fn().mockResolvedValue({ id: 1, isActive: false }),
  };
}

describe('platform user routes', () => {
  it('GET / returns user list', async () => {
    const svc = mockUserMgmtSvc();
    const app = createPlatformUserRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(2);
  });

  it('POST / creates user with valid body', async () => {
    const svc = mockUserMgmtSvc();
    const app = createPlatformUserRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'new_user', password: 'pass123456' }),
    });
    expect(res.status).toBe(201);
    expect(svc.createUser).toHaveBeenCalled();
  });

  it('POST / returns 400 for missing username', async () => {
    const svc = mockUserMgmtSvc();
    const app = createPlatformUserRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'pass123456' }),
    });
    expect(res.status).toBe(400);
  });
});
