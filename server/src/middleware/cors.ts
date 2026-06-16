import type { Context, Next } from 'hono';
import { config } from '../config/index.js';

export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('origin') || '';
  const allowed = config.cors.origins;
  const isAllowed = allowed.includes(origin) || config.env === 'development';

  if (isAllowed) {
    c.header('Access-Control-Allow-Origin', origin || '*');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Tenant-Id');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Max-Age', '86400');
  }

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: isAllowed ? 204 : 403 });
  }

  await next();
}
