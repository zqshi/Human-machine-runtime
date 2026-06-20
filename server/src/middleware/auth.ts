import type { Context, Next } from 'hono';
import * as jose from 'jose';
import { config } from '../config/index.js';
import type { Principal } from '../contexts/identity-access/auth-service.js';

export type { Principal };

export interface JwtPayload {
  sub: string;
  scope: string;
  role: string;
  tenantId: string | null;
  permissions: string[];
}

const jwtSecret = new TextEncoder().encode(config.jwt.secret);

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('authorization');

  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (!token) {
      return c.json({ error: 'Missing token' }, 401);
    }

    // 生产路径：authService 已注入时走 authenticateToken 回查 DB，
    // 以 DB 当前状态构造 Principal（不信任 JWT 内 role/scope/tenantId/permissions），
    // 防止 JWT 篡改 / 降权后旧 token / 越权。回查失败一律 401，不回退到不安全的纯验签。
    const authService = c.get('authService') as
      | { authenticateToken(authHeader: string): Promise<Principal> }
      | undefined;
    if (authService?.authenticateToken) {
      try {
        const principal = await authService.authenticateToken(header);
        c.set('user', principal);
        await next();
        return;
      } catch {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }
    }

    // 无 authService（非生产装配 / 单测）：回退纯验签，保持启动可用
    const hmrPrincipal = await tryHmrJwt(token);
    if (hmrPrincipal) {
      c.set('user', hmrPrincipal);
      await next();
      return;
    }

    const upstreamPrincipal = await tryUpstreamToken(c, token);
    if (upstreamPrincipal) {
      c.set('user', upstreamPrincipal);
      c.set('upstreamToken', token);
      await next();
      return;
    }

    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const sessionCookie = parseCookie(
    c.req.header('cookie') ?? '',
    config.auth?.session?.cookieName ?? 'hmr_session'
  );
  if (sessionCookie) {
    const authService = c.get('authService') as
      | { validateSession(id: string): Promise<(Principal & { upstreamToken?: string }) | null> }
      | undefined;
    if (authService) {
      const result = await authService.validateSession(sessionCookie);
      if (result) {
        const { upstreamToken, ...principal } = result;
        c.set('user', principal);
        if (upstreamToken) c.set('upstreamToken', upstreamToken);
        await next();
        return;
      }
    }
  }

  return c.json({ error: 'Missing or invalid Authorization header' }, 401);
}

async function tryHmrJwt(token: string): Promise<Principal | null> {
  try {
    const { payload } = await jose.jwtVerify(token, jwtSecret);
    const decoded = payload as unknown as JwtPayload;
    return {
      username: decoded.sub ?? '',
      scope: decoded.scope ?? 'tenant',
      role: decoded.role ?? '',
      tenantId: decoded.tenantId ?? null,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
    };
  } catch {
    return null;
  }
}

async function tryUpstreamToken(c: Context, token: string): Promise<Principal | null> {
  if (config.auth.defaultProvider !== 'platform-be-proxy') return null;
  if (!config.auth.platformBe.baseUrl) return null;

  const authService = c.get('authService') as
    | { handleUpstreamToken(token: string): Promise<Principal | null> }
    | undefined;
  if (authService?.handleUpstreamToken) {
    return authService.handleUpstreamToken(token);
  }

  return null;
}

function parseCookie(header: string, name: string): string | null {
  if (!header) return null;
  const prefix = `${name}=`;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

export function requireScope(...scopes: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as Principal | undefined;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (!scopes.includes(user.scope)) {
      return c.json({ error: 'Forbidden: insufficient scope' }, 403);
    }
    await next();
  };
}

export function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as Principal | undefined;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const perms = user.permissions || [];
    if (perms.includes('platform:*') || perms.includes('*') || perms.includes(permission)) {
      await next();
      return;
    }
    return c.json({ error: `Forbidden: ${permission}` }, 403);
  };
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as Principal | undefined;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}

export function getUpstreamToken(c: Context): string | undefined {
  return c.get('upstreamToken') as string | undefined;
}
