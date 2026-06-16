import { describe, it, expect, vi } from 'vitest';
import { createPlatformRoleRoutes } from './roles.js';

function mockUserMgmtSvc() {
  return {
    listRoles: vi.fn().mockResolvedValue({
      roles: [
        { id: 'r-1', name: 'admin', displayName: 'Admin' },
        { id: 'r-2', name: 'viewer', displayName: 'Viewer' },
      ],
      permissions: ['read', 'write', 'admin'],
    }),
    createRole: vi.fn().mockResolvedValue({ id: 'r-3', name: 'editor', displayName: 'Editor' }),
    updateRole: vi.fn().mockResolvedValue({ id: 'r-1', name: 'admin', displayName: 'Super Admin' }),
    deleteRole: vi.fn().mockResolvedValue(true),
  };
}

describe('platform role routes', () => {
  it('GET / returns roles with permissions', async () => {
    const svc = mockUserMgmtSvc();
    const app = createPlatformRoleRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roles).toHaveLength(2);
    expect(body.permissions).toBeDefined();
  });

  it('POST / creates role', async () => {
    const svc = mockUserMgmtSvc();
    const app = createPlatformRoleRoutes(svc as never);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'editor', displayName: 'Editor' }),
    });
    expect(res.status).toBe(201);
    expect(svc.createRole).toHaveBeenCalled();
  });
});
