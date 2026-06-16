import { describe, it, expect, vi } from 'vitest';
import { createAuthRoutes } from './auth.js';

function mockAuthService(overrides: Record<string, unknown> = {}) {
  return {
    login: vi.fn().mockResolvedValue({
      token: 'mock-token',
      tokenType: 'Bearer',
      expiresInSec: 86400,
      user: { username: 'admin', scope: 'platform', role: 'platform_admin', permissions: [] },
      sessionId: 'sess-123',
    }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    getRegistry: () => ({ listRegistered: () => ['local'] }),
    getSSOAuthorizationUrl: vi.fn().mockReturnValue('https://sso.example.com/authorize?state=abc'),
    handleSSOCallback: vi.fn().mockResolvedValue({
      token: 'sso-token',
      tokenType: 'Bearer',
      user: { username: 'sso-user', scope: 'platform', role: 'platform_admin', permissions: [] },
      sessionId: 'sess-sso',
    }),
    validateSession: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as never;
}

describe('auth routes', () => {
  describe('POST /login', () => {
    it('returns success for valid credentials', async () => {
      const authService = mockAuthService();
      const app = createAuthRoutes(authService);
      const res = await app.request('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.token).toBe('mock-token');
      expect(res.headers.get('Set-Cookie')).toContain('hmr_session=sess-123');
    });

    it('returns 400 for missing credentials', async () => {
      const authService = mockAuthService();
      const app = createAuthRoutes(authService);
      const res = await app.request('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '', password: '' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('invalid request');
    });

    it('returns 500 when login throws', async () => {
      const authService = mockAuthService({
        login: vi.fn().mockRejectedValue(new Error('invalid credentials')),
      });
      const app = createAuthRoutes(authService);
      const res = await app.request('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /providers', () => {
    it('returns available providers', async () => {
      const authService = mockAuthService();
      const app = createAuthRoutes(authService);
      const res = await app.request('/providers');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.available).toContain('local');
    });
  });

  describe('POST /sso/callback', () => {
    it('returns 400 when code/state missing', async () => {
      const authService = mockAuthService();
      const app = createAuthRoutes(authService);
      const res = await app.request('/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('returns 403 with unknown state (CSRF protection)', async () => {
      const authService = mockAuthService();
      const app = createAuthRoutes(authService);
      const res = await app.request('/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'auth-code', state: 'forged-state' }),
      });
      expect(res.status).toBe(403);
    });

    it('succeeds with valid code and state from authorize', async () => {
      const authService = mockAuthService();
      const app = createAuthRoutes(authService);

      const authRes = await app.request('/sso/authorize?provider=oidc');
      const authBody = await authRes.json();
      const state = authBody.data.state;

      const res = await app.request('/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'auth-code', state }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.token).toBe('sso-token');
    });
  });
});
