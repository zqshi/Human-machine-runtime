/**
 * SSO OAuth state 持久化(CSRF token + PKCE code_verifier)。
 *
 * 协议(RFC 6749 + RFC 7636):
 *   1. /sso/authorize: 生成 state + codeVerifier → 计算 codeChallenge → save(state, ...)
 *   2. 浏览器跳转 IdP,带 state + code_challenge
 *   3. /sso/callback: 收到 code + state → consume(state)(读出 + 删除,一次性)
 *      → 用 codeVerifier 调 IdP token 端点
 *
 * 实现:
 *   - MemoryOAuthStateStore: 测试 / 默认降级(单进程)
 *   - DbOAuthStateStore: 生产持久化(多副本共享)
 *
 * 安全约束:
 *   - state 必须一次性消费(consume 后立即删除)
 *   - state TTL ≤ 10 分钟(authorize 与 callback 之间不应太久)
 *   - codeVerifier 必须不可猜测(43~128 字符)
 */

import { createHash, randomBytes, type Hash } from 'node:crypto';

export interface OAuthStateRecord {
  /** CSRF token,授权 URL 的 state 参数 */
  state: string;
  /** provider 类型(oidc/wps-oauth/...) */
  providerCode: string;
  /** 回调 URI(防 replace attack) */
  redirectUri: string;
  /** PKCE code_verifier,可选(provider 支持时下发) */
  codeVerifier?: string;
  /** 过期时间(consume 时校验) */
  expiresAt: Date;
}

export interface IOAuthStateStore {
  /** 写入 state 记录(TTL 由调用方决定) */
  save(record: OAuthStateRecord): Promise<void>;
  /** 一次性消费:成功返回记录并删除,失败/过期/不存在返回 null */
  consume(state: string): Promise<OAuthStateRecord | null>;
  /** 清理已过期记录(定时任务调用) */
  deleteExpired(): Promise<number>;
}

/** 默认 state TTL:10 分钟 */
export const OAUTH_STATE_DEFAULT_TTL_MS = 10 * 60 * 1000;

/**
 * 生成 PKCE code_verifier(RFC 7636 §4.1:43~128 字符的 [A-Z][a-z][0-9]-._~)。
 * 用 32 字节随机数 base64url 得 43 字符(下界)。
 */
export function generateCodeVerifier(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * 由 code_verifier 计算 code_challenge(RFC 7636 §4.2:S256 = BASE64URL(SHA256(ascii(verifier))))。
 */
export function computeCodeChallenge(verifier: string): string {
  const h: Hash = createHash('sha256');
  h.update(verifier, 'ascii');
  return h.digest('base64url');
}

/**
 * 生成 state token:32 字节随机数 hex(64 字符),不可预测。
 */
export function generateState(): string {
  return randomBytes(32).toString('hex');
}

/**
 * 内存实现(默认降级 + 单元测试用)。
 * 生产环境应使用 DbOAuthStateStore 共享 state 到多副本。
 */
export class MemoryOAuthStateStore implements IOAuthStateStore {
  private store = new Map<string, OAuthStateRecord>();

  async save(record: OAuthStateRecord): Promise<void> {
    this.store.set(record.state, { ...record });
  }

  async consume(state: string): Promise<OAuthStateRecord | null> {
    const record = this.store.get(state);
    if (!record) return null;
    this.store.delete(state);
    if (Date.now() > record.expiresAt.getTime()) return null;
    return record;
  }

  async deleteExpired(): Promise<number> {
    const now = Date.now();
    let deleted = 0;
    for (const [key, rec] of this.store) {
      if (now > rec.expiresAt.getTime()) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }
}
