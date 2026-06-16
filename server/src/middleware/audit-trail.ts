import type { Context, Next } from 'hono';
import type { AuditService } from '../contexts/audit-observability/audit-service.js';
import type { Principal } from './auth.js';

export function auditTrailMiddleware(auditService: AuditService) {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const durationMs = Date.now() - start;
    const status = c.res.status;
    const user = c.get('user') as Principal | undefined;

    const action = deriveAction(method, path);
    if (!action) return;

    try {
      auditService.log(
        action,
        {
          method,
          path,
          status,
          durationMs,
          query: Object.fromEntries(new URL(c.req.url).searchParams),
        },
        {
          actor: user
            ? { username: user.username, role: user.role }
            : { username: 'anonymous', role: 'unknown' },
        }
      );
    } catch {
      // audit failures must never block the response
    }
  };
}

function deriveAction(method: string, path: string): string | null {
  if (path.startsWith('/api/proxy/')) {
    const service = path.split('/')[3] ?? 'unknown';
    return `proxy.${service}.${method.toLowerCase()}`;
  }

  if (path.startsWith('/api/admin/')) {
    const resource = path.split('/')[3] ?? 'unknown';
    return `admin.${resource}.${method.toLowerCase()}`;
  }

  if (path.startsWith('/api/platform/')) {
    const resource = path.split('/')[3] ?? 'unknown';
    return `platform.${resource}.${method.toLowerCase()}`;
  }

  return null;
}
