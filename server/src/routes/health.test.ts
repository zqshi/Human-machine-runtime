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
        { name: 'marketplace', configured: true, healthy: true, circuit: 'closed' },
        { name: 'profile-service', configured: false, healthy: false, circuit: 'open' },
        { name: 'workspace-backend', configured: true, healthy: true, circuit: 'closed' },
        { name: 'container-orchestrator', configured: false, healthy: false, circuit: 'open' },
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
      const marketplace = body.gateways.find((g: { name: string }) => g.name === 'marketplace');
      expect(marketplace.configured).toBe(true);
      expect(marketplace.circuit).toBe('closed');
      const profileService = body.gateways.find(
        (g: { name: string }) => g.name === 'profile-service'
      );
      expect(profileService.configured).toBe(false);
      expect(body.auth.defaultProvider).toContain('local');
    });
  });
});
