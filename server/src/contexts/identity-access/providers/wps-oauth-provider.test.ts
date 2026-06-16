import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WpsOAuthProvider } from './wps-oauth-provider.js';

const mockConfig = {
  clientId: 'wps-test-id',
  clientSecret: 'wps-test-secret',
  scopes: ['openid', 'profile', 'email'],
  redirectUri: 'http://localhost:3002/api/auth/sso/callback',
};

describe('WpsOAuthProvider', () => {
  let provider: WpsOAuthProvider;

  beforeEach(() => {
    provider = new WpsOAuthProvider(mockConfig);
  });

  it('has type "wps-oauth"', () => {
    expect(provider.type).toBe('wps-oauth');
  });

  it('generates authorization URL with correct params', () => {
    const url = provider.getAuthorizationUrl('state123', 'http://example.com/cb');
    expect(url).toContain('https://openapi.wps.cn/oauth2/auth');
    expect(url).toContain('client_id=wps-test-id');
    expect(url).toContain('state=state123');
    expect(url).toContain('redirect_uri=http%3A%2F%2Fexample.com%2Fcb');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=openid+profile+email');
  });

  it('uses config redirectUri when none provided', () => {
    const url = provider.getAuthorizationUrl('s', '');
    expect(url).toContain(encodeURIComponent(mockConfig.redirectUri));
  });

  it('rejects direct authenticate call', async () => {
    await expect(provider.authenticate({})).rejects.toThrow('authorization URL flow');
  });

  it('handleCallback exchanges code and fetches userinfo', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'at_123',
          refresh_token: 'rt_456',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'wps_user_001',
          name: 'Alice',
          email: 'zhangsan@wps.cn',
          picture: 'https://avatar.wps.cn/user.jpg',
        }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const result = await provider.handleCallback('code_abc', 'state_xyz', 'http://localhost/cb');

    expect(result.externalId).toBe('wps_user_001');
    expect(result.username).toBe('zhangsan');
    expect(result.email).toBe('zhangsan@wps.cn');
    expect(result.displayName).toBe('Alice');
    expect(result.upstreamToken).toBe('at_123');
    expect(result.refreshToken).toBe('rt_456');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const tokenCall = mockFetch.mock.calls[0];
    expect(tokenCall[0]).toBe('https://openapi.wps.cn/oauth2/token');

    vi.unstubAllGlobals();
  });

  it('handleCallback throws on token exchange failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      })
    );

    await expect(provider.handleCallback('bad', 's', 'http://x/cb')).rejects.toThrow(
      'WPS token exchange failed: 400'
    );

    vi.unstubAllGlobals();
  });

  it('refreshAccessToken calls WPS token endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_at',
          refresh_token: 'new_rt',
          expires_in: 7200,
        }),
      })
    );

    const result = await provider.refreshAccessToken('old_rt');
    expect(result.accessToken).toBe('new_at');
    expect(result.refreshToken).toBe('new_rt');
    expect(result.expiresIn).toBe(7200);

    vi.unstubAllGlobals();
  });
});
