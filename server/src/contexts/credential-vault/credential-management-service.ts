import { CredentialService } from './credential-service.js';
import { LeaseService } from './lease-service.js';
import {
  CredentialRepository,
  type AuthorizationRecord,
  type LeaseRecord,
  type SecretMeta,
} from '../../db/repositories/credential-repository.js';

/**
 * CredentialManagementService — credential-vault 的 application 层。
 *
 * 组合 domain(CredentialService 加解密 / LeaseService lease 计算)+ adapters(CredentialRepository 持久化)。
 * 职责:
 *   - createCredential:encrypt plaintext + 存 authorization + secret
 *   - listCredentials / getCredential:返回凭证元数据(不含 plaintext,安全)
 *   - getCredentialSecret:解密返回明文(内部能力,供可信调用方如 tool-management;不通过管理面 HTTP 返回)
 *   - lease 签发/吊销/列表
 *
 * 不实现(超出 v1.2.1 范围):
 *   - secret 轮换(keyVersion 递增逻辑)
 *   - lease redeem(用 lease 换 secret 的可信交换)
 */
export interface CreateCredentialInput {
  userId: number;
  providerId: number;
  externalAccountId?: string | null;
  scope?: string | null;
  secretType: string;
  plaintext: string;
}

/** T37:多 secret 凭证(DB username+password 等)。secrets 数组每项 {secretType, plaintext}。 */
export interface CreateCredentialWithSecretsInput {
  userId: number;
  providerId: number;
  externalAccountId?: string | null;
  scope?: string | null;
  secrets: Array<{ secretType: string; plaintext: string }>;
}

export interface CredentialDetail extends AuthorizationRecord {
  secrets: SecretMeta[];
}

export class CredentialManagementService {
  constructor(
    private readonly repo: CredentialRepository,
    private readonly credentialService: CredentialService,
    private readonly leaseService: LeaseService
  ) {}

  async createCredential(input: CreateCredentialInput): Promise<{ id: number }> {
    const authz = await this.repo.createAuthorization({
      userId: input.userId,
      providerId: input.providerId,
      externalAccountId: input.externalAccountId,
      scope: input.scope,
    });
    const ciphertext = this.credentialService.encrypt(input.plaintext);
    await this.repo.saveSecret(authz.id, input.secretType, ciphertext);
    return { id: authz.id };
  }

  /**
   * T37:建 authz + 存多个 secret(DB username+password 等)。
   *
   * DB 连接凭证需 username/password 两 secret 关联同一 authz。createCredential 只存单 secret
   * (OAuth 模型),本方法支持多 secret,供 McpDatabaseFlow 真连接凭证链路用。
   * 返回 authz.id(作 tool source 的 credentialId)。
   */
  async createCredentialWithSecrets(
    input: CreateCredentialWithSecretsInput
  ): Promise<{ id: number }> {
    const authz = await this.repo.createAuthorization({
      userId: input.userId,
      providerId: input.providerId,
      externalAccountId: input.externalAccountId,
      scope: input.scope,
    });
    for (const secret of input.secrets) {
      const ciphertext = this.credentialService.encrypt(secret.plaintext);
      await this.repo.saveSecret(authz.id, secret.secretType, ciphertext);
    }
    return { id: authz.id };
  }

  async listCredentials(limit = 50, offset = 0): Promise<AuthorizationRecord[]> {
    return this.repo.listAuthorizations({}, limit, offset);
  }

  async getCredential(id: number): Promise<CredentialDetail | null> {
    const authz = await this.repo.getAuthorization(id);
    if (!authz) return null;
    const secrets = await this.repo.listSecrets(id);
    return { ...authz, secrets };
  }

  async deleteCredential(id: number): Promise<void> {
    await this.repo.deleteAuthorization(id);
  }

  /**
   * 解密取明文(内部能力)。
   * 供可信调用方(如 tool-management db 连接测试)按 credentialId + secretType 取解密 secret。
   * 不通过管理面 HTTP 端点返回明文——明文只在服务间内部流转。
   */
  async getCredentialSecret(id: number, secretType: string): Promise<string | null> {
    const ciphertext = await this.repo.getSecretCiphertext(id, secretType);
    if (!ciphertext) return null;
    return this.credentialService.decrypt(ciphertext);
  }

  async issueLease(input: {
    userId: number;
    providerId: number;
    scope?: string | null;
    ttlSec?: number;
  }): Promise<LeaseRecord> {
    const expiresAt = this.leaseService.computeExpiry(input.ttlSec);
    return this.repo.createLease({
      userId: input.userId,
      providerId: input.providerId,
      scope: input.scope,
      expiresAt,
    });
  }

  async revokeLease(leaseId: string): Promise<void> {
    await this.repo.revokeLease(leaseId);
  }

  async listLeases(
    filter: { userId?: number; status?: string } = {},
    limit = 50,
    offset = 0
  ): Promise<LeaseRecord[]> {
    return this.repo.listLeases(filter, limit, offset);
  }
}
