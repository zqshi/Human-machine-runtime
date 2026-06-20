import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import * as jose from 'jose';
import { authMiddleware, requireScope, requirePermission, requireRole } from './auth.js';
import { config } from '../config/index.js';

const jwtSecret = new TextEncoder().encode(config.jwt.secret);

async function makeToken(payload: Record<string, unknown>) {
  return new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(jwtSecret);
}

function buildApp() {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.get('/test', (c) => {
    const user = c.get('user');
    return c.json({ user });
  });
  return app;
}

describe('authMiddleware', () => {
  it('returns 401 when no auth header', async () => {
    const app = buildApp();
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Missing');
  });

  it('returns 401 for empty Bearer token', async () => {
    const app = buildApp();
    const res = await app.request('/test', {
      headers: { authorization: 'Bearer ' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const app = buildApp();
    const res = await app.request('/test', {
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  it('sets user context for valid token', async () => {
    const app = buildApp();
    const token = await makeToken({
      sub: 'admin',
      scope: 'platform',
      role: 'platform_admin',
      tenantId: null,
      permissions: ['platform:*'],
    });
    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.username).toBe('admin');
    expect(body.user.scope).toBe('platform');
    expect(body.user.permissions).toContain('platform:*');
  });

  it('returns 401 for expired token', async () => {
    const app = buildApp();
    const token = await new jose.SignJWT({
      sub: 'admin',
      scope: 'platform',
      role: 'admin',
      permissions: [],
    } as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(0)
      .sign(jwtSecret);
    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });
});

describe('authMiddleware · DB 回查防越权', () => {
  function buildAppWithAuthService(authService: unknown) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      (c as unknown as { set(k: string, v: unknown): void }).set('authService', authService);
      await next();
    });
    app.use('*', authMiddleware);
    app.get('/test', (c) => c.json({ user: c.get('user') }));
    return app;
  }

  it('authService 存在时走 authenticateToken 回查，JWT 内伪造的 tenantId/permissions 被忽略（以 DB 为准）', async () => {
    const authenticateToken = vi.fn(async () => ({
      username: 'admin',
      scope: 'tenant',
      role: 'tenant_admin',
      tenantId: 'real-tenant',
      permissions: ['tenant:instance:read'],
    }));
    const app = buildAppWithAuthService({ authenticateToken });
    // JWT 故意伪造 tenantId 与越权 permissions
    const token = await makeToken({
      sub: 'admin',
      scope: 'tenant',
      role: 'tenant_admin',
      tenantId: 'fake-tenant',
      permissions: ['platform:*'],
    });
    const res = await app.request('/test', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.tenantId).toBe('real-tenant'); // DB 为准，非 JWT 的 fake
    expect(body.user.permissions).toEqual(['tenant:instance:read']); // DB 权限，非 JWT 越权
    expect(authenticateToken).toHaveBeenCalledOnce();
    expect(authenticateToken.mock.calls[0][0]).toMatch(/^Bearer /);
  });

  it('authService.authenticateToken 抛错（用户禁用/不存在）→ 401，不回退到不安全的纯验签', async () => {
    const authenticateToken = vi.fn(async () => {
      throw new Error('user disabled');
    });
    const app = buildAppWithAuthService({ authenticateToken });
    // 即便 JWT 签名合法，回查失败也必须拒绝（防降权后旧 token 仍有效）
    const token = await makeToken({
      sub: 'admin',
      scope: 'platform',
      role: 'platform_admin',
      tenantId: null,
      permissions: ['platform:*'],
    });
    const res = await app.request('/test', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });
});

describe('requireScope', () => {
  it('passes when scope matches', async () => {
    const app = new Hono();
    app.use('*', authMiddleware);
    app.use('*', requireScope('platform'));
    app.get('/test', (c) => c.json({ ok: true }));

    const token = await makeToken({
      sub: 'admin',
      scope: 'platform',
      role: 'admin',
      permissions: [],
    });
    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('returns 403 when scope mismatch', async () => {
    const app = new Hono();
    app.use('*', authMiddleware);
    app.use('*', requireScope('platform'));
    app.get('/test', (c) => c.json({ ok: true }));

    const token = await makeToken({
      sub: 'user',
      scope: 'tenant',
      role: 'viewer',
      permissions: [],
    });
    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

describe('requirePermission', () => {
  it('passes for wildcard permission', async () => {
    const app = new Hono();
    app.use('*', authMiddleware);
    app.use('*', requirePermission('admin:write'));
    app.get('/test', (c) => c.json({ ok: true }));

    const token = await makeToken({
      sub: 'admin',
      scope: 'platform',
      role: 'admin',
      permissions: ['platform:*'],
    });
    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('returns 403 when permission missing', async () => {
    const app = new Hono();
    app.use('*', authMiddleware);
    app.use('*', requirePermission('admin:write'));
    app.get('/test', (c) => c.json({ ok: true }));

    const token = await makeToken({
      sub: 'user',
      scope: 'tenant',
      role: 'viewer',
      permissions: ['tenant:read'],
    });
    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

describe('requireRole', () => {
  it('passes for matching role', async () => {
    const app = new Hono();
    app.use('*', authMiddleware);
    app.use('*', requireRole('platform_admin'));
    app.get('/test', (c) => c.json({ ok: true }));

    const token = await makeToken({
      sub: 'admin',
      scope: 'platform',
      role: 'platform_admin',
      permissions: [],
    });
    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-matching role', async () => {
    const app = new Hono();
    app.use('*', authMiddleware);
    app.use('*', requireRole('platform_admin'));
    app.get('/test', (c) => c.json({ ok: true }));

    const token = await makeToken({
      sub: 'user',
      scope: 'tenant',
      role: 'viewer',
      permissions: [],
    });
    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});
