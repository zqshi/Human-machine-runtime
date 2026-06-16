import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { UserRepository } from '../../db/repositories/user-repository.js';
import { ROLE_PERMISSIONS } from './auth-service.js';

export class UserManagementService {
  constructor(private userRepo: UserRepository) {}

  async listUsers(filters?: { scope?: string; role?: string }) {
    const rows = await this.userRepo.listAllUsers(filters);
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      scope: u.scope,
      tenantId: u.tenantId,
      isActive: u.isActive,
      source: u.source,
      createdAt: u.createdAt,
    }));
  }

  async createUser(input: {
    username: string;
    password: string;
    role?: string;
    scope?: string;
    displayName?: string;
    email?: string;
  }) {
    const hash = await bcrypt.hash(input.password, 10);
    return this.userRepo.createUser({
      username: input.username.trim(),
      passwordHash: `bcrypt:${hash}`,
      role: input.role ?? 'platform_ops',
      scope: input.scope ?? 'platform',
      displayName: input.displayName,
      email: input.email,
      source: 'platform',
    });
  }

  async updateUser(id: number, patch: Record<string, unknown>) {
    return this.userRepo.updateUser(id, patch);
  }

  async resetPassword(userId: number) {
    const newPassword = 'reset' + Date.now().toString(36).slice(-6);
    const hash = await bcrypt.hash(newPassword, 10);
    const ok = await this.userRepo.resetPassword(userId, `bcrypt:${hash}`);
    if (!ok) return null;
    return { temporaryPassword: newPassword };
  }

  async toggleDisable(userId: number) {
    return this.userRepo.toggleDisable(userId);
  }

  async listRoles() {
    const roles = await this.userRepo.listRoles();
    const allPermissions = Object.entries(ROLE_PERMISSIONS).flatMap(([, perms]) => perms);
    const uniquePerms = [...new Set(allPermissions)].map((p) => ({ id: p, name: p }));
    return { roles, permissions: uniquePerms };
  }

  async createRole(input: { name: string; displayName: string; permissions?: string[] }) {
    return this.userRepo.createRole(input);
  }

  async updateRole(id: number, patch: { displayName?: string; permissions?: string[] }) {
    return this.userRepo.updateRole(id, patch);
  }

  async deleteRole(id: number) {
    return this.userRepo.deleteRole(id);
  }

  async createUserForAdmin(input: {
    username: string;
    password: string;
    role?: string;
    scope?: string;
    tenantId?: string;
    displayName?: string;
    email?: string;
  }) {
    const hash = await bcrypt.hash(input.password, 10);
    return this.userRepo.createUser({
      username: input.username.trim(),
      passwordHash: `bcrypt:${hash}`,
      role: input.role ?? 'tenant_ops',
      scope: input.scope ?? 'tenant',
      tenantId: input.tenantId,
      displayName: input.displayName,
      email: input.email,
      source: 'admin',
    });
  }

  async deleteUser(id: number) {
    return this.userRepo.deleteUser(id);
  }

  async assignRole(userId: number, roleId: number) {
    return this.userRepo.assignRole(userId, roleId);
  }

  async removeRoleAssignment(userId: number, roleId: number) {
    return this.userRepo.removeRoleAssignment(userId, roleId);
  }

  async syncUsersFromUpstream(
    upstreamUsers: Array<{
      id: number;
      username?: string;
      name?: string;
      email?: string;
      roles?: string[];
    }>,
    providerType: string
  ): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const u of upstreamUsers) {
      const externalId = String(u.id);
      const existing = await this.userRepo.findByExternalId(providerType, externalId);

      if (!existing) {
        const hash = await bcrypt.hash(crypto.randomUUID(), 10);
        const user = await this.userRepo.createUser({
          username: u.username || u.name || `ext_${externalId}`,
          passwordHash: hash,
          role: u.roles?.includes('admin') ? 'platform_admin' : 'tenant_ops',
          scope: 'tenant',
          displayName: u.name,
          email: u.email,
          source: `sync:${providerType}`,
        });

        await this.userRepo.linkExternalIdentity(user.id, providerType, externalId, {
          email: u.email,
          displayName: u.name,
        });
        created++;
      } else {
        if (u.name || u.email) {
          await this.userRepo.updateUser(existing.id!, {
            displayName: u.name,
            email: u.email,
          });
          updated++;
        } else {
          skipped++;
        }
      }
    }

    return { created, updated, skipped };
  }
}
