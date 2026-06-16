import { describe, it, expect, vi } from 'vitest';
import { createPlatformConfigRoutes } from './config.js';

function mockConfigSvc() {
  return {
    listSystemConfigs: vi.fn().mockResolvedValue({
      'feature.sso': 'false',
      'tenant.maxAgents': '5',
    }),
    batchSetSystemConfigs: vi.fn().mockResolvedValue(undefined),
  };
}

describe('platform config routes', () => {
  it('GET / returns config object with schema defaults merged', async () => {
    const svc = mockConfigSvc();
    const app = createPlatformConfigRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toBeDefined();
    expect(body.config['tenant.maxAgents']).toMatchObject({ source: 'config', value: 5 });
    expect(body.config['feature.sso']).toMatchObject({ value: false, source: 'env' });
  });

  it('PUT / updates configs', async () => {
    const svc = mockConfigSvc();
    const app = createPlatformConfigRoutes(svc as never);
    const res = await app.request('/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sso_enabled: 'true' }),
    });
    expect(res.status).toBe(200);
    expect(svc.batchSetSystemConfigs).toHaveBeenCalledWith({ sso_enabled: 'true' });
  });
});
