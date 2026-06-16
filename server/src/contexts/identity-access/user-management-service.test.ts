import { describe, it, expect, vi } from 'vitest';
import { UserManagementService } from './user-management-service.js';
import type { UserRepository } from '../../db/repositories/user-repository.js';

function mockRepo(): UserRepository {
  const users: Record<number, Record<string, unknown>> = {};
  let nextId = 1;
  return {
    listAllUsers: vi.fn(async () => Object.values(users)),
    createUser: vi.fn(async (data: Record<string, unknown>) => {
      const user = { id: nextId++, ...data, isActive: true, createdAt: new Date().toISOString() };
      users[user.id] = user;
      return user;
    }),
    updateUser: vi.fn(async (id: number, patch: Record<string, unknown>) => {
      if (!users[id]) return null;
      Object.assign(users[id], patch);
      return users[id];
    }),
    resetPassword: vi.fn(async (id: number, hash: string) => {
      if (!users[id]) return false;
      users[id].passwordHash = hash;
      return true;
    }),
    toggleDisable: vi.fn(async (id: number) => {
      if (!users[id]) return null;
      users[id].isActive = !users[id].isActive;
      return users[id];
    }),
    deleteUser: vi.fn(async () => true),
    listRoles: vi.fn(async () => [{ id: 1, name: 'admin', displayName: 'Admin' }]),
    createRole: vi.fn(async (input: Record<string, unknown>) => ({ id: 2, ...input })),
    updateRole: vi.fn(async (id: number, patch: Record<string, unknown>) => ({ id, ...patch })),
    deleteRole: vi.fn(async () => true),
    assignRole: vi.fn(async () => true),
    removeRoleAssignment: vi.fn(async () => true),
  } as unknown as UserRepository;
}

describe('UserManagementService', () => {
  it('createUser hashes password and sets defaults', async () => {
    const repo = mockRepo();
    const svc = new UserManagementService(repo);
    const user = await svc.createUser({ username: 'alice', password: 'pw123' });
    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'alice',
        role: 'platform_ops',
        scope: 'platform',
        source: 'platform',
      })
    );
    const call = (repo.createUser as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.passwordHash).toMatch(/^bcrypt:/);
  });

  it('createUser trims username', async () => {
    const repo = mockRepo();
    const svc = new UserManagementService(repo);
    await svc.createUser({ username: '  bob  ', password: 'pw' });
    const call = (repo.createUser as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.username).toBe('bob');
  });

  it('listUsers maps fields correctly', async () => {
    const repo = mockRepo();
    const svc = new UserManagementService(repo);
    await svc.createUser({ username: 'u1', password: 'pw' });
    const list = await svc.listUsers();
    expect(list.length).toBe(1);
    expect(list[0]).toHaveProperty('username');
    expect(list[0]).toHaveProperty('role');
  });

  it('resetPassword returns temporary password', async () => {
    const repo = mockRepo();
    const svc = new UserManagementService(repo);
    const user = await svc.createUser({ username: 'c', password: 'old' });
    const result = await svc.resetPassword(user.id as number);
    expect(result).toHaveProperty('temporaryPassword');
    expect(result!.temporaryPassword).toMatch(/^reset/);
  });

  it('resetPassword returns null for unknown user', async () => {
    const repo = mockRepo();
    (repo.resetPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const svc = new UserManagementService(repo);
    expect(await svc.resetPassword(999)).toBeNull();
  });

  it('listRoles includes role_permissions', async () => {
    const repo = mockRepo();
    const svc = new UserManagementService(repo);
    const { roles, permissions } = await svc.listRoles();
    expect(roles.length).toBeGreaterThan(0);
    expect(permissions.length).toBeGreaterThan(0);
  });

  it('createUserForAdmin sets admin source', async () => {
    const repo = mockRepo();
    const svc = new UserManagementService(repo);
    await svc.createUserForAdmin({ username: 'adm', password: 'pw', tenantId: 'tn_1' });
    const call = (repo.createUser as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.source).toBe('admin');
    expect(call.role).toBe('tenant_ops');
    expect(call.tenantId).toBe('tn_1');
  });

  it('deleteUser delegates to repo', async () => {
    const repo = mockRepo();
    const svc = new UserManagementService(repo);
    await svc.deleteUser(1);
    expect(repo.deleteUser).toHaveBeenCalledWith(1);
  });

  it('assignRole delegates to repo', async () => {
    const repo = mockRepo();
    const svc = new UserManagementService(repo);
    await svc.assignRole(1, 2);
    expect(repo.assignRole).toHaveBeenCalledWith(1, 2);
  });

  describe('syncUsersFromUpstream', () => {
    it('creates new user when external id not found', async () => {
      const repo = mockRepo();
      (repo as any).findByExternalId = vi.fn(async () => null);
      (repo as any).linkExternalIdentity = vi.fn(async () => undefined);
      const svc = new UserManagementService(repo);
      const result = await svc.syncUsersFromUpstream(
        [{ id: 100, username: 'ext_user', name: 'Ext', email: 'e@x.com' }],
        'platform-be'
      );
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(repo.createUser).toHaveBeenCalled();
      expect((repo as any).linkExternalIdentity).toHaveBeenCalled();
    });

    it('updates existing user when name/email changed', async () => {
      const repo = mockRepo();
      (repo as any).findByExternalId = vi.fn(async () => ({ id: 5, username: 'old' }));
      (repo as any).linkExternalIdentity = vi.fn(async () => undefined);
      const svc = new UserManagementService(repo);
      const result = await svc.syncUsersFromUpstream(
        [{ id: 200, name: 'New Name', email: 'new@e.com' }],
        'platform-be'
      );
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
      expect(repo.updateUser).toHaveBeenCalledWith(5, {
        displayName: 'New Name',
        email: 'new@e.com',
      });
    });

    it('skips user when no name or email to update', async () => {
      const repo = mockRepo();
      (repo as any).findByExternalId = vi.fn(async () => ({ id: 5, username: 'old' }));
      const svc = new UserManagementService(repo);
      const result = await svc.syncUsersFromUpstream([{ id: 300 }], 'platform-be');
      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
    });
  });
});
