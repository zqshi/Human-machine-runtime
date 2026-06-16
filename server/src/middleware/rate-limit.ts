import type { Context, Next } from 'hono';
import { config } from '../config/index.js';
import type { Principal } from './auth.js';

const hits = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL_MS = 60_000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

export async function rateLimitMiddleware(c: Context, next: Next) {
  const user = c.get('user') as Principal | undefined;
  const key =
    user?.username || c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

  const now = Date.now();
  let entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.rateLimit.windowMs };
    hits.set(key, entry);
  }

  entry.count++;

  c.header('X-RateLimit-Limit', String(config.rateLimit.max));
  c.header('X-RateLimit-Remaining', String(Math.max(0, config.rateLimit.max - entry.count)));
  c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > config.rateLimit.max) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  await next();
}
