import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import type { Database } from '../client.js';
import { userAuthorizations, credentialSecrets, credentialLeases } from '../schema/credential.js';

/**
 * credential-vault 数据访问层。
 *
 * 三张表(均已在 schema/credential.ts + identity.ts migration 定义,无需建表):
 *   - user_authorizations:用户对外部 provider 的授权记录
 *   - credential_secrets:授权的加密密钥(repo 只存 ciphertext,加密由 application 层 CredentialService 负责)
 *   - credential_leases:密钥租约(TTL/吊销)
 *
 * 设计:repo 纯持久化,不含加密逻辑(加密是 domain 职责,由 CredentialManagementService 组合)。
 * secret 的 getSecretCiphertext 返回密文,由 service 层 decrypt;listSecrets 不返回 ciphertext(安全)。
 */

export interface AuthorizationRecord {
  id: number;
  userId: number;
  providerId: number;
  externalAccountId: string | null;
  scope: string | null;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretMeta {
  id: number;
  authorizationId: number;
  secretType: string;
  keyVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaseRecord {
  id: number;
  leaseId: string;
  userId: number;
  providerId: number;
  scope: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface CreateAuthorizationInput {
  userId: number;
  providerId: number;
  externalAccountId?: string | null;
  scope?: string | null;
  status?: string;
  expiresAt?: Date | null;
}

export interface CreateLeaseInput {
  userId: number;
  providerId: number;
  scope?: string | null;
  expiresAt: Date;
}

export class CredentialRepository {
  constructor(private db: Database) {}

  /* ──── Authorizations ──── */

  async createAuthorization(input: CreateAuthorizationInput): Promise<AuthorizationRecord> {
    const [row] = await this.db
      .insert(userAuthorizations)
      .values({
        userId: input.userId,
        providerId: input.providerId,
        externalAccountId: input.externalAccountId ?? null,
        scope: input.scope ?? null,
        status: input.status ?? 'active',
        expiresAt: input.expiresAt ?? null,
      })
      .returning();
    return toAuthorization(row);
  }

  async getAuthorization(id: number): Promise<AuthorizationRecord | null> {
    const [row] = await this.db
      .select()
      .from(userAuthorizations)
      .where(eq(userAuthorizations.id, id))
      .limit(1);
    return row ? toAuthorization(row) : null;
  }

  async listAuthorizations(
    filter: { userId?: number; providerId?: number } = {},
    limit = 50,
    offset = 0
  ): Promise<AuthorizationRecord[]> {
    const conditions = [];
    if (filter.userId !== undefined) conditions.push(eq(userAuthorizations.userId, filter.userId));
    if (filter.providerId !== undefined)
      conditions.push(eq(userAuthorizations.providerId, filter.providerId));
    const rows = await this.db
      .select()
      .from(userAuthorizations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(userAuthorizations.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toAuthorization);
  }

  async deleteAuthorization(id: number): Promise<void> {
    // 删关联 secrets,再删 authorization。leases 独立管理(按 userId+providerId 关联,
    // 非直接挂 authorizationId),通过 revokeLease 吊销或 revokeExpiredLeases 自然过期,此处不级联删。
    await this.db.delete(credentialSecrets).where(eq(credentialSecrets.authorizationId, id));
    await this.db.delete(userAuthorizations).where(eq(userAuthorizations.id, id));
  }

  /* ──── Secrets(repo 存 ciphertext,不加密) ──── */

  async saveSecret(
    authorizationId: number,
    secretType: string,
    ciphertext: string
  ): Promise<number> {
    const [row] = await this.db
      .insert(credentialSecrets)
      .values({ authorizationId, secretType, ciphertext })
      .returning({ id: credentialSecrets.id });
    return row.id;
  }

  /** 返回密文,由 application 层 decrypt */
  async getSecretCiphertext(authorizationId: number, secretType: string): Promise<string | null> {
    const [row] = await this.db
      .select({ ciphertext: credentialSecrets.ciphertext })
      .from(credentialSecrets)
      .where(
        and(
          eq(credentialSecrets.authorizationId, authorizationId),
          eq(credentialSecrets.secretType, secretType)
        )
      )
      .limit(1);
    return row?.ciphertext ?? null;
  }

  /** 列出 secret 元数据(不含 ciphertext,安全) */
  async listSecrets(authorizationId: number): Promise<SecretMeta[]> {
    const rows = await this.db
      .select({
        id: credentialSecrets.id,
        authorizationId: credentialSecrets.authorizationId,
        secretType: credentialSecrets.secretType,
        keyVersion: credentialSecrets.keyVersion,
        createdAt: credentialSecrets.createdAt,
        updatedAt: credentialSecrets.updatedAt,
      })
      .from(credentialSecrets)
      .where(eq(credentialSecrets.authorizationId, authorizationId))
      .orderBy(desc(credentialSecrets.createdAt));
    return rows;
  }

  async deleteSecrets(authorizationId: number): Promise<void> {
    await this.db
      .delete(credentialSecrets)
      .where(eq(credentialSecrets.authorizationId, authorizationId));
  }

  /* ──── Leases ──── */

  async createLease(input: CreateLeaseInput): Promise<LeaseRecord> {
    const [row] = await this.db
      .insert(credentialLeases)
      .values({
        userId: input.userId,
        providerId: input.providerId,
        scope: input.scope ?? null,
        status: 'active',
        expiresAt: input.expiresAt,
      })
      .returning();
    return toLease(row);
  }

  /** 查找未吊销 lease(过期判断由 service 层 LeaseService.isExpired 处理,repo 只保证未吊销) */
  async findValidLease(leaseId: string): Promise<LeaseRecord | null> {
    const [row] = await this.db
      .select()
      .from(credentialLeases)
      .where(and(eq(credentialLeases.leaseId, leaseId), isNull(credentialLeases.revokedAt)))
      .limit(1);
    return row ? toLease(row) : null;
  }

  async revokeLease(leaseId: string): Promise<void> {
    await this.db
      .update(credentialLeases)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(credentialLeases.leaseId, leaseId));
  }

  async listLeases(
    filter: { userId?: number; status?: string } = {},
    limit = 50,
    offset = 0
  ): Promise<LeaseRecord[]> {
    const conditions = [];
    if (filter.userId !== undefined) conditions.push(eq(credentialLeases.userId, filter.userId));
    if (filter.status) conditions.push(eq(credentialLeases.status, filter.status));
    const rows = await this.db
      .select()
      .from(credentialLeases)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(credentialLeases.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toLease);
  }

  async revokeExpiredLeases(): Promise<number> {
    const deleted = await this.db
      .update(credentialLeases)
      .set({ status: 'expired', revokedAt: new Date() })
      .where(and(eq(credentialLeases.status, 'active'), lt(credentialLeases.expiresAt, new Date())))
      .returning({ id: credentialLeases.id });
    return deleted.length;
  }
}

/* ──── Row → Domain 映射 ──── */

function toAuthorization(row: typeof userAuthorizations.$inferSelect): AuthorizationRecord {
  return {
    id: row.id,
    userId: row.userId,
    providerId: row.providerId,
    externalAccountId: row.externalAccountId,
    scope: row.scope,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLease(row: typeof credentialLeases.$inferSelect): LeaseRecord {
  return {
    id: row.id,
    leaseId: row.leaseId,
    userId: row.userId,
    providerId: row.providerId,
    scope: row.scope,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}
