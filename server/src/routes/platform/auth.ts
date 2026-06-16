import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import crypto from 'crypto';
import { AuthService } from '../../contexts/identity-access/auth-service.js';
import { authMiddleware, type Principal } from '../../middleware/auth.js';
import { config } from '../../config/index.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

const SSO_STATE_TTL_MS = 10 * 60 * 1000;
const ssoStateStore = new Map<string, { provider: string; createdAt: number }>();

function cleanExpiredStates(): void {
  const now = Date.now();
  for (const [key, val] of ssoStateStore) {
    if (now - val.createdAt > SSO_STATE_TTL_MS) ssoStateStore.delete(key);
  }
}

function buildCookieDomain(): string {
  if (config.env !== 'production') return '';
  const origins = config.cors.origins;
  if (!origins.length) return '';
  try {
    const host = new URL(origins[0]).hostname;
    const parts = host.split('.');
    if (parts.length >= 2) return `; Domain=.${parts.slice(-2).join('.')}`;
  } catch {
    /* ignore */
  }
  return '';
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  scope: z.enum(['platform', 'tenant']).optional(),
  tenantId: z.string().optional(),
});

const ssoCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  redirect_uri: z.string().optional(),
  provider: z.string().optional(),
});

export function createAuthRoutes(authService: AuthService) {
  const app = new Hono();

  app.post('/login', async (c) => {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400);
    }

    if (config.auth.defaultProvider !== 'local' && !config.auth.allowLocalFallback) {
      return c.json({ error: 'local login disabled, use SSO' }, 403);
    }

    const { username, password, scope, tenantId } = parsed.data;
    const result = await authService.login(username, password, {
      requiredScope: scope,
      tenantId,
      createSession: true,
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
      userAgent: c.req.header('user-agent'),
    });

    if (result.sessionId) {
      const cookieName = config.auth.session.cookieName;
      const maxAge = config.auth.session.maxAgeSec;
      const secure = config.env === 'production' ? '; Secure' : '';
      const cookieDomain = buildCookieDomain();
      c.header(
        'Set-Cookie',
        `${cookieName}=${result.sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}${cookieDomain}`
      );
    }

    return c.json({ success: true, data: result });
  });

  app.get('/me', authMiddleware, (c) => {
    const user = getUser(c);
    return c.json({ success: true, data: user });
  });

  app.post('/logout', authMiddleware, async (c) => {
    const cookieName = config.auth.session.cookieName;
    const sessionCookie = parseCookieValue(c.req.header('cookie') ?? '', cookieName);
    if (sessionCookie) {
      await authService.revokeSession(sessionCookie);
    }
    c.header('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; Max-Age=0`);
    return c.json({ success: true, message: 'logged out' });
  });

  app.get('/acl', authMiddleware, (c) => {
    const user = getUser(c);
    return c.json({
      success: true,
      data: {
        username: user.username,
        scope: user.scope,
        role: user.role,
        permissions: user.permissions,
      },
    });
  });

  app.get('/providers', (c) => {
    const registered = authService.getRegistry().listRegistered();
    return c.json({
      success: true,
      data: {
        default: config.auth.defaultProvider,
        available: registered,
        ssoEnabled: registered.some((t) => t !== 'local'),
      },
    });
  });

  app.get('/sso/authorize', (c) => {
    const providerType = c.req.query('provider') ?? config.auth.defaultProvider;
    const redirectUri = c.req.query('redirect_uri') ?? config.auth.oidc.redirectUri;
    if (providerType === 'local') {
      return c.json({ error: 'SSO not applicable for local provider' }, 400);
    }

    cleanExpiredStates();
    const state = crypto.randomBytes(32).toString('hex');
    ssoStateStore.set(state, { provider: providerType, createdAt: Date.now() });

    try {
      const url = authService.getSSOAuthorizationUrl(providerType, state, redirectUri);
      return c.json({ success: true, data: { url, state } });
    } catch (e) {
      ssoStateStore.delete(state);
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  app.post('/sso/callback', async (c) => {
    const body = await c.req.json();
    const parsed = ssoCallbackSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'code and state required', details: parsed.error.flatten() }, 400);
    }
    const { code, state, redirect_uri, provider } = parsed.data;

    const storedState = ssoStateStore.get(state);
    if (!storedState) {
      return c.json({ error: 'invalid or expired SSO state (CSRF check failed)' }, 403);
    }
    if (Date.now() - storedState.createdAt > SSO_STATE_TTL_MS) {
      ssoStateStore.delete(state);
      return c.json({ error: 'SSO state expired, please retry' }, 403);
    }
    ssoStateStore.delete(state);

    const providerType = provider ?? storedState.provider ?? config.auth.defaultProvider;
    const redirectUri = redirect_uri ?? config.auth.oidc.redirectUri;

    const result = await authService.handleSSOCallback(code, state, redirectUri, providerType, {
      createSession: true,
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
      userAgent: c.req.header('user-agent'),
    });

    const cookieDomain = buildCookieDomain();
    if (result.sessionId) {
      const cookieName = config.auth.session.cookieName;
      const maxAge = config.auth.session.maxAgeSec;
      const secure = config.env === 'production' ? '; Secure' : '';
      c.header(
        'Set-Cookie',
        `${cookieName}=${result.sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}${cookieDomain}`
      );
    }

    return c.json({ success: true, data: result });
  });

  return app;
}

function parseCookieValue(header: string, name: string): string | null {
  if (!header) return null;
  const prefix = `${name}=`;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return null;
}
