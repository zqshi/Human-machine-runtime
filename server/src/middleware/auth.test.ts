import { describe, it, expect } from 'vitest';
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
