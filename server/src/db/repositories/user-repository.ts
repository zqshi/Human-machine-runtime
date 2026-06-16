import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Database } from '../client.js';
import { users, userRoles, userRoleAssignments, externalIdentities } from '../schema/identity.js';
import type { IUserRepository, UserRecord } from '../../contexts/identity-access/auth-service.js';
import type { LocalUserRecord } from '../../contexts/identity-access/providers/local-provider.js';
import type { AuthResult } from '../../contexts/identity-access/auth-provider.js';

export class UserRepository implements IUserRepository {
  constructor(private db: Database) {}

  async listPlatformUsers() {
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        password: users.passwordHash,
        role: users.role,
        scope: users.scope,
        tenantId: users.tenantId,
        disabled: users.isActive,
      })
      .from(users);

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      password: r.password,
      role: r.role,
      scope: r.scope ?? 'tenant',
      tenantId: r.tenantId ?? undefined,
      disabled: !r.disabled,
    }));
  }

  async findByUsername(username: string) {
    const [row] = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return row ?? null;
  }

  async findById(id: number) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async listAllUsers(filters?: { scope?: string; role?: string; tenantId?: string }) {
    const conditions = [];
    if (filters?.scope) conditions.push(eq(users.scope, filters.scope));
    if (filters?.role) conditions.push(eq(users.role, filters.role));
    if (filters?.tenantId) conditions.push(eq(users.tenantId, filters.tenantId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return this.db.select().from(users).where(where);
  }

  async createUser(data: {
    username: string;
    passwordHash: string;
    role: string;
    scope: string;
    tenantId?: string;
    displayName?: string;
    email?: string;
    source?: string;
  }) {
    const [row] = await this.db
      .insert(users)
      .values({
        username: data.username,
        passwordHash: data.passwordHash,
        role: data.role,
        scope: data.scope,
        tenantId: data.tenantId ?? null,
        displayName: data.displayName ?? null,
        email: data.email ?? null,
        source: data.source ?? 'dynamic',
      })
      .returning();
    return row!;
  }

  async updateUser(
    id: number,
    patch: Partial<{
      displayName: string;
      email: string;
      role: string;
      scope: string;
      tenantId: string | null;
      isActive: boolean;
    }>
  ) {
    const [row] = await this.db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row ?? null;
  }

  async deleteUser(id: number) {
    const [row] = await this.db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return !!row;
  }

  async resetPassword(id: number, newHash: string) {
    const [row] = await this.db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return !!row;
  }

  async toggleDisable(id: number) {
    const user = await this.findById(id);
    if (!user) return null;
    const [row] = await this.db
      .update(users)
      .set({ isActive: !user.isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row ?? null;
  }

  /* ──── Roles ──── */

  async listRoles() {
    return this.db.select().from(userRoles);
  }

  async createRole(data: { name: string; displayName: string; permissions?: string[] }) {
    const [row] = await this.db
      .insert(userRoles)
      .values({
        name: data.name,
        displayName: data.displayName,
        permissions: data.permissions ?? [],
      })
      .returning();
    return row!;
  }

  async updateRole(
    id: number,
    patch: Partial<{ name: string; displayName: string; permissions: string[] }>
  ) {
    const [row] = await this.db
      .update(userRoles)
      .set(patch)
      .where(eq(userRoles.id, id))
      .returning();
    return row ?? null;
  }

  async deleteRole(id: number) {
    const [row] = await this.db.delete(userRoles).where(eq(userRoles.id, id)).returning();
    return !!row;
  }

  /* ──── Role Assignments ──── */

  async assignRole(userId: number, roleId: number, assignedBy?: string) {
    const [row] = await this.db
      .insert(userRoleAssignments)
      .values({ userId, roleId, assignedBy: assignedBy ?? null })
      .onConflictDoNothing()
      .returning();
    return row ?? null;
  }

  async removeRoleAssignment(userId: number, roleId: number) {
    const [row] = await this.db
      .delete(userRoleAssignments)
      .where(and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.roleId, roleId)))
      .returning();
    return !!row;
  }

  /* ──── ILocalUserStore ──── */

  async findLocalUser(username: string): Promise<LocalUserRecord | null> {
    const [row] = await this.db
      .select({
        username: users.username,
        passwordHash: users.passwordHash,
        email: users.email,
        displayName: users.displayName,
        disabled: users.isActive,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (!row) return null;
    return {
      username: row.username,
      passwordHash: row.passwordHash,
      email: row.email ?? undefined,
      displayName: row.displayName ?? undefined,
      disabled: !row.disabled,
    };
  }

  async linkExternalIdentity(
    userId: number,
    providerType: string,
    externalId: string,
    profile?: { email?: string; displayName?: string }
  ) {
    await this.db
      .insert(externalIdentities)
      .values({
        userId,
        providerType,
        externalId,
        email: profile?.email ?? null,
        displayName: profile?.displayName ?? null,
        lastLoginAt: new Date(),
      })
      .onConflictDoNothing();
  }

  /* ──── External Identity ──── */

  async findByExternalId(providerType: string, externalId: string): Promise<UserRecord | null> {
    const [ext] = await this.db
      .select({ userId: externalIdentities.userId })
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.providerType, providerType),
          eq(externalIdentities.externalId, externalId)
        )
      )
      .limit(1);
    if (!ext) return null;

    const [user] = await this.db.select().from(users).where(eq(users.id, ext.userId)).limit(1);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      password: user.passwordHash,
      role: user.role,
      scope: user.scope,
      tenantId: user.tenantId ?? undefined,
      disabled: !user.isActive,
    };
  }

  async createFromExternal(
    authResult: AuthResult,
    providerType: string,
    defaults: Partial<UserRecord>
  ): Promise<UserRecord> {
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
    const [user] = await this.db
      .insert(users)
      .values({
        username: authResult.username,
        passwordHash,
        role: defaults.role ?? 'tenant_ops',
        scope: defaults.scope ?? 'tenant',
        tenantId: defaults.tenantId ?? null,
        displayName: authResult.displayName ?? null,
        email: authResult.email ?? null,
        source: `sso:${providerType}`,
      })
      .returning();

    await this.db.insert(externalIdentities).values({
      userId: user!.id,
      providerType,
      externalId: authResult.externalId,
      email: authResult.email ?? null,
      displayName: authResult.displayName ?? null,
      avatarUrl: authResult.avatarUrl ?? null,
      rawClaims: authResult.rawClaims ?? null,
      lastLoginAt: new Date(),
    });

    return {
      id: user!.id,
      username: user!.username,
      password: user!.passwordHash,
      role: user!.role,
      scope: user!.scope,
      tenantId: user!.tenantId ?? undefined,
      disabled: !user!.isActive,
    };
  }
}
