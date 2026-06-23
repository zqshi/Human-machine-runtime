import { describe, it, expect, vi, beforeAll } from 'vitest';
import { OIDCAuthProvider } from './oidc-provider.js';
import { generateCodeVerifier, computeCodeChallenge } from '../oauth-state-store.js';

/**
 * Mock fetch 辅助:返回静态 discovery 文档。
 * 测试用 SSE-style 响应模拟 OIDC IdP。
 */
function mockDiscoveryFetch(): void {
  const discovery = {
    authorization_endpoint: 'https://idp.example.com/authorize',
    token_endpoint: 'https://idp.example.com/token',
    userinfo_endpoint: 'https://idp.example.com/userinfo',
    jwks_uri: 'https://idp.example.com/jwks',
    issuer: 'https://idp.example.com',
  };
  const originalFetch = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = url.toString();
      if (u.endsWith('/.well-known/openid-configuration')) {
        return new Response(JSON.stringify(discovery), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.endsWith('/token')) {
        // 验证 PKCE:body 应含 code_verifier
        const body = init?.body?.toString() ?? '';
        return new Response(
          JSON.stringify({
            access_token: 'at-xxx',
            id_token: undefined,
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (u.endsWith('/userinfo')) {
        return new Response(
          JSON.stringify({
            sub: 'user-123',
            preferred_username: 'alice',
            email: 'alice@example.com',
            name: 'Alice',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('not found', { status: 404 });
    })
  );
}

describe('OIDCAuthProvider PKCE', () => {
  let provider: OIDCAuthProvider;

  beforeAll(() => {
    mockDiscoveryFetch();
    provider = new OIDCAuthProvider({
      issuer: 'https://idp.example.com',
      clientId: 'client-123',
      clientSecret: 'secret',
      scopes: ['openid', 'profile', 'email'],
    });
  });

  it('getAuthorizationUrl 默认不含 code_challenge', async () => {
    await provider.ensureDiscovery();
    const url = provider.getAuthorizationUrl!('state-1', 'https://app/cb');
    expect(url).toContain('https://idp.example.com/authorize?');
    expect(url).toContain('client_id=client-123');
    expect(url).toContain('state=state-1');
    expect(url).not.toContain('code_challenge');
    expect(url).not.toContain('code_challenge_method');
  });

  it('getAuthorizationUrl 收到 codeChallenge 时拼上 + S256', async () => {
    const verifier = generateCodeVerifier();
    const challenge = computeCodeChallenge(verifier);
    const url = provider.getAuthorizationUrl!('state-2', 'https://app/cb', challenge);
    expect(url).toContain('code_challenge=');
    expect(url).toContain('code_challenge_method=S256');
    // URL 参数应被 URL-encode(challenge 含 - _ 字符无需 encode,但测试存在即可)
    expect(url).toContain(challenge);
  });

  it('handleCallback 无 codeVerifier 时不报错', async () => {
    const result = await provider.handleCallback!('auth-code', 'state-x', 'https://app/cb');
    expect(result.externalId).toBe('user-123');
    expect(result.username).toBe('alice');
  });

  it('handleCallback 传 codeVerifier 时透传到 token 端点', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockClear();
    const verifier = generateCodeVerifier();
    await provider.handleCallback!('auth-code', 'state-y', 'https://app/cb', verifier);
    // 找到 token endpoint 调用
    const tokenCall = fetchSpy.mock.calls.find((c) => c[0]?.toString().endsWith('/token'));
    expect(tokenCall).toBeDefined();
    const body = (tokenCall![1]?.body ?? '').toString();
    expect(body).toContain(`code_verifier=${verifier}`);
  });

  it('handleCallback 不传 codeVerifier 时 body 不含 code_verifier', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockClear();
    await provider.handleCallback!('auth-code', 'state-z', 'https://app/cb');
    const tokenCall = fetchSpy.mock.calls.find((c) => c[0]?.toString().endsWith('/token'));
    expect(tokenCall).toBeDefined();
    const body = (tokenCall![1]?.body ?? '').toString();
    expect(body).not.toContain('code_verifier');
  });
});
