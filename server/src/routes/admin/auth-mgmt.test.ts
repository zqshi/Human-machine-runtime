import { describe, it, expect, vi } from 'vitest';
import { createAdminAuthMgmtRoutes } from './auth-mgmt.js';

function mockUserMgmtSvc() {
  return {
    listUsers: vi.fn().mockResolvedValue([{ id: 1, username: 'admin' }]),
    createUserForAdmin: vi.fn().mockResolvedValue({ id: 2, username: 'new_user' }),
    updateUser: vi.fn().mockResolvedValue({ id: 1, username: 'admin', role: 'updated' }),
    deleteUser: vi.fn().mockResolvedValue(true),
    listRoles: vi.fn().mockResolvedValue({ roles: [{ id: 1, name: 'admin' }] }),
    createRole: vi.fn().mockResolvedValue({ id: 2, name: 'editor' }),
    updateRole: vi.fn().mockResolvedValue({ id: 1, name: 'admin', displayName: 'Super Admin' }),
    deleteRole: vi.fn().mockResolvedValue(true),
    assignRole: vi.fn().mockResolvedValue({ success: true }),
    removeRoleAssignment: vi.fn().mockResolvedValue(true),
  };
}

describe('admin auth-mgmt routes', () => {
  it('GET /health returns ok', async () => {
    const svc = mockUserMgmtSvc();
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('GET /users returns user list', async () => {
    const svc = mockUserMgmtSvc();
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/users');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
  });

  it('POST /users creates user', async () => {
    const svc = mockUserMgmtSvc();
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'new_user', password: 'pass123456' }),
    });
    expect(res.status).toBe(201);
    expect(svc.createUserForAdmin).toHaveBeenCalled();
  });

  it('POST /users returns 400 for short password', async () => {
    const svc = mockUserMgmtSvc();
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'u', password: '123' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /users/:id updates user', async () => {
    const svc = mockUserMgmtSvc();
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/users/1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    });
    expect(res.status).toBe(200);
    expect(svc.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ role: 'viewer' }));
  });

  it('POST /users/:id returns 404 when not found', async () => {
    const svc = mockUserMgmtSvc();
    svc.updateUser.mockResolvedValue(null);
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/users/999', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /roles returns role list', async () => {
    const svc = mockUserMgmtSvc();
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/roles');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roles).toHaveLength(1);
  });

  it('POST /roles creates role', async () => {
    const svc = mockUserMgmtSvc();
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'editor', displayName: 'Editor' }),
    });
    expect(res.status).toBe(201);
  });

  it('POST /role-assignments assigns role', async () => {
    const svc = mockUserMgmtSvc();
    const app = createAdminAuthMgmtRoutes(svc as never);
    const res = await app.request('/role-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '1', roleId: '2' }),
    });
    expect(res.status).toBe(200);
    expect(svc.assignRole).toHaveBeenCalled();
  });
});
