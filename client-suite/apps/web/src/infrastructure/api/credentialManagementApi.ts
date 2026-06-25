/**
 * credential-vault 管理面 API Client — 凭证 CRUD + lease 管理。
 *
 * 消费后端 routes/admin/credentials.ts（7 端点，v1.2.1 已就绪）。路由前缀 /api/admin/credentials。
 * 底层 request 由统一 httpClient 工厂提供（401/超时/重试已处理）。
 *
 * 安全约束：
 *   - createCredential 提交 plaintext 后后端只返回 { id }，明文不回显不存前端。
 *   - getCredential 返回的 secrets 仅含 SecretMeta 元数据（后端 listSecrets 已剔除 ciphertext）。
 */
import { request } from './httpClient';

/* ---------- DTO Types（后端 Date → 前端 string ISO，照 v19AdminApi 惯例） ---------- */

export interface CredentialAuthorization {
  id: number;
  userId: number;
  providerId: number;
  externalAccountId: string | null;
  scope: string | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialSecretMeta {
  id: number;
  authorizationId: number;
  secretType: string;
  keyVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialDetail extends CredentialAuthorization {
  secrets: CredentialSecretMeta[];
}

export interface CredentialLease {
  id: number;
  leaseId: string;
  userId: number;
  providerId: number;
  scope: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreateCredentialInput {
  userId: number;
  providerId: number;
  externalAccountId?: string;
  scope?: string;
  secretType: string;
  plaintext: string;
}

/* ---------- query 拼接（跳过 undefined/空串） ---------- */

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.set(k, String(v));
  return `?${usp.toString()}`;
}

const BASE = '/api/admin/credentials';

/* ---------- API ---------- */

export const credentialManagementApi = {
  listCredentials(
    opts: { limit?: number; offset?: number } = {}
  ): Promise<{ credentials: CredentialAuthorization[] }> {
    return request(`${BASE}${buildQuery({ limit: opts.limit ?? 50, offset: opts.offset ?? 0 })}`);
  },

  createCredential(input: CreateCredentialInput): Promise<{ id: number }> {
    return request(BASE, { method: 'POST', body: JSON.stringify(input) });
  },

  getCredential(id: number): Promise<CredentialDetail> {
    return request(`${BASE}/${id}`);
  },

  deleteCredential(id: number): Promise<{ success: boolean }> {
    return request(`${BASE}/${id}`, { method: 'DELETE' });
  },

  listLeases(
    opts: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<{ leases: CredentialLease[] }> {
    return request(
      `${BASE}/leases${buildQuery({
        limit: opts.limit ?? 50,
        offset: opts.offset ?? 0,
        status: opts.status,
      })}`
    );
  },

  issueLease(id: number, opts: { ttlSec?: number } = {}): Promise<CredentialLease> {
    return request(`${BASE}/${id}/leases`, { method: 'POST', body: JSON.stringify(opts) });
  },

  revokeLease(leaseId: string): Promise<{ success: boolean }> {
    return request(`${BASE}/leases/${encodeURIComponent(leaseId)}`, { method: 'DELETE' });
  },
};
