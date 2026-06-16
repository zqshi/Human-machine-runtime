import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../config/index.js', () => ({
  config: {
    rateLimit: { windowMs: 1000, max: 3 },
  },
}));

import { rateLimitMiddleware } from './rate-limit.js';

function buildApp() {
  const app = new Hono();
  app.use('*', rateLimitMiddleware);
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 200 with rate limit headers', async () => {
    const app = buildApp();
    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('2');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('returns 429 when rate limit exceeded', async () => {
    const app = buildApp();
    for (let i = 0; i < 3; i++) {
      await app.request('/test');
    }
    const res = await app.request('/test');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Too many requests');
  });

  it('resets after window expires', async () => {
    const app = buildApp();
    for (let i = 0; i < 3; i++) {
      await app.request('/test');
    }
    const blocked = await app.request('/test');
    expect(blocked.status).toBe(429);

    vi.advanceTimersByTime(1500);
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });
});
