import { describe, it, expect } from 'vitest';
import type { AppContext } from '../app/bootstrap.js';
import { createHealthRoutes } from './health.js';

function mockCtx(dbConnected = true): AppContext {
  return {
    analyticsService: {
      checkDbHealth: async () => (dbConnected ? 'healthy' : 'unhealthy'),
    },
    authService: {
      getRegistry: () => ({ listRegistered: () => ['local'] }),
    },
    gatewayHealth: {
      getStatus: () => [
        { name: 'clawhub', configured: true, healthy: true, circuit: 'closed' },
        { name: 'portal', configured: false, healthy: false, circuit: 'open' },
        { name: 'xspace', configured: true, healthy: true, circuit: 'closed' },
        { name: 'claw-farm', configured: false, healthy: false, circuit: 'open' },
        { name: 'litellm', configured: true, healthy: true, circuit: 'closed' },
        { name: 'platform-be', configured: false, healthy: false, circuit: 'open' },
      ],
    },
  } as unknown as AppContext;
}

describe('health routes', () => {
  describe('GET /', () => {
    it('returns ok status', async () => {
      const app = createHealthRoutes(mockCtx());
      const res = await app.request('/');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('hmr-server');
      expect(body.timestamp).toBeTruthy();
    });
  });

  describe('GET /ready', () => {
    it('returns ready when DB is connected', async () => {
      const app = createHealthRoutes(mockCtx(true));
      const res = await app.request('/ready');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ready');
      expect(body.checks.db).toBe('connected');
    });

    it('returns 503 when DB is disconnected', async () => {
      const app = createHealthRoutes(mockCtx(false));
      const res = await app.request('/ready');
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.status).toBe('not_ready');
      expect(body.checks.db).toBe('disconnected');
    });
  });

  describe('GET /detail', () => {
    it('returns gateway status details', async () => {
      const app = createHealthRoutes(mockCtx());
      const res = await app.request('/detail');
      expect(res.status).toBe(200);
      const body = await res.json();
      const clawhub = body.gateways.find((g: { name: string }) => g.name === 'clawhub');
      expect(clawhub.configured).toBe(true);
      expect(clawhub.circuit).toBe('closed');
      const portal = body.gateways.find((g: { name: string }) => g.name === 'portal');
      expect(portal.configured).toBe(false);
      expect(body.auth.defaultProvider).toContain('local');
    });
  });
});
