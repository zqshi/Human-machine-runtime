import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createInternalAuthMiddleware } from './internal-auth';

function appWith(secret: string) {
  const app = new Hono();
  app.use('*', createInternalAuthMiddleware(secret));
  app.get('/x', (c) => c.json({ ok: true }));
  return app;
}

describe('internal-auth middleware (T18b-A)', () => {
  it('secret 未配 → 503(防误开:无密钥时 internal 路由不可用)', async () => {
    const res = await appWith('').request('/x');
    expect(res.status).toBe(503);
  });

  it('无 X-Internal-Secret header → 401', async () => {
    const res = await appWith('s3cret').request('/x');
    expect(res.status).toBe(401);
  });

  it('X-Internal-Secret 错误 → 401', async () => {
    const res = await appWith('s3cret').request('/x', {
      headers: { 'X-Internal-Secret': 'wrong' },
    });
    expect(res.status).toBe(401);
  });

  it('X-Internal-Secret 正确 → 放行 200', async () => {
    const res = await appWith('s3cret').request('/x', {
      headers: { 'X-Internal-Secret': 's3cret' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
