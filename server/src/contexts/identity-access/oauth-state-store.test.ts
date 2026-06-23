import { describe, it, expect } from 'vitest';
import {
  MemoryOAuthStateStore,
  generateCodeVerifier,
  computeCodeChallenge,
  generateState,
  OAUTH_STATE_DEFAULT_TTL_MS,
} from './oauth-state-store.js';

describe('PKCE 工具函数', () => {
  it('generateCodeVerifier 返回 base64url 字符串(无 =,43+ 字符)', () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v).not.toContain('=');
  });

  it('generateCodeVerifier 默认 32 字节 → 43 字符', () => {
    // base64url(32 bytes) = 43 chars without padding
    expect(generateCodeVerifier(32).length).toBe(43);
  });

  it('computeCodeChallenge 输出确定性 + base64url 格式', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    // RFC 7636 附录 B 的测试向量
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(computeCodeChallenge(verifier)).toBe(expected);
  });

  it('不同 verifier 产生不同 challenge', () => {
    const a = computeCodeChallenge('verifier-a-1234567890');
    const b = computeCodeChallenge('verifier-b-1234567890');
    expect(a).not.toBe(b);
  });

  it('generateState 返回 64 字符 hex', () => {
    const s = generateState();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it('OAUTH_STATE_DEFAULT_TTL_MS = 10 分钟', () => {
    expect(OAUTH_STATE_DEFAULT_TTL_MS).toBe(10 * 60 * 1000);
  });
});

describe('MemoryOAuthStateStore', () => {
  it('save + consume 返回相同记录', async () => {
    const store = new MemoryOAuthStateStore();
    const record = {
      state: 'state-1',
      providerCode: 'oidc',
      redirectUri: 'https://app.example.com/cb',
      codeVerifier: 'verifier-1',
      expiresAt: new Date(Date.now() + 60_000),
    };
    await store.save(record);
    const got = await store.consume('state-1');
    expect(got).toEqual(record);
  });

  it('consume 是一次性:第二次返回 null', async () => {
    const store = new MemoryOAuthStateStore();
    await store.save({
      state: 'state-2',
      providerCode: 'oidc',
      redirectUri: 'https://app/cb',
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await store.consume('state-2')).not.toBeNull();
    expect(await store.consume('state-2')).toBeNull();
  });

  it('不存在的 state 返回 null', async () => {
    const store = new MemoryOAuthStateStore();
    expect(await store.consume('never')).toBeNull();
  });

  it('过期 state 视为无效(consume 返回 null)', async () => {
    const store = new MemoryOAuthStateStore();
    await store.save({
      state: 'expired',
      providerCode: 'oidc',
      redirectUri: 'https://app/cb',
      expiresAt: new Date(Date.now() - 1000), // 过去时间
    });
    expect(await store.consume('expired')).toBeNull();
  });

  it('deleteExpired 清理过期记录', async () => {
    const store = new MemoryOAuthStateStore();
    await store.save({
      state: 'expired-1',
      providerCode: 'oidc',
      redirectUri: 'cb',
      expiresAt: new Date(Date.now() - 1000),
    });
    await store.save({
      state: 'expired-2',
      providerCode: 'oidc',
      redirectUri: 'cb',
      expiresAt: new Date(Date.now() - 500),
    });
    await store.save({
      state: 'alive-1',
      providerCode: 'oidc',
      redirectUri: 'cb',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const deleted = await store.deleteExpired();
    expect(deleted).toBe(2);
    expect(await store.consume('expired-1')).toBeNull();
    expect(await store.consume('alive-1')).not.toBeNull();
  });
});
