import { describe, it, expect, vi } from 'vitest';
import { createAdminFeatureFlagRoutes } from './feature-flags.js';
import type { SystemConfigService } from '../../contexts/system-config/system-config-service.js';

function mockSvc() {
  return {
    getFeatureFlags: vi.fn().mockResolvedValue([
      { enabled: true, rolloutPct: 100 },
      { enabled: false, killSwitch: false },
    ]),
    getFeatureFlag: vi.fn().mockResolvedValue({ enabled: true, rolloutPct: 50 }),
    setFeatureFlag: vi.fn().mockResolvedValue(undefined),
  } as unknown as SystemConfigService;
}

describe('createAdminFeatureFlagRoutes', () => {
  it('GET / 列出全部 flag', async () => {
    const svc = mockSvc();
    const app = createAdminFeatureFlagRoutes(svc);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(svc.getFeatureFlags).toHaveBeenCalled();
    const body = await res.json();
    expect(body.flags).toHaveLength(2);
  });

  it('GET /:key 查询单个 flag', async () => {
    const svc = mockSvc();
    const app = createAdminFeatureFlagRoutes(svc);
    const res = await app.request('/feature-x');
    expect(res.status).toBe(200);
    expect(svc.getFeatureFlag).toHaveBeenCalledWith('feature-x');
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });

  it('GET /:key 不存在返回 404', async () => {
    const svc = mockSvc();
    (svc.getFeatureFlag as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createAdminFeatureFlagRoutes(svc);
    const res = await app.request('/missing');
    expect(res.status).toBe(404);
  });

  it('PUT /:key 设置 flag(整体覆盖,透传 config)', async () => {
    const svc = mockSvc();
    const app = createAdminFeatureFlagRoutes(svc);
    const res = await app.request('/feature-x', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, rolloutPct: 30, allowedTenants: ['t1'] }),
    });
    expect(res.status).toBe(200);
    expect(svc.setFeatureFlag).toHaveBeenCalledWith(
      'feature-x',
      expect.objectContaining({ enabled: true, rolloutPct: 30, allowedTenants: ['t1'] })
    );
    const body = await res.json();
    expect(body.key).toBe('feature-x');
    expect(body.flag.enabled).toBe(true);
  });

  it('PUT /:key 校验失败(缺必填 enabled)返回 400,不调 service', async () => {
    const svc = mockSvc();
    const app = createAdminFeatureFlagRoutes(svc);
    const res = await app.request('/feature-x', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolloutPct: 30 }),
    });
    expect(res.status).toBe(400);
    expect(svc.setFeatureFlag).not.toHaveBeenCalled();
  });

  it('PUT /:key rolloutPct 越界(>100)返回 400', async () => {
    const svc = mockSvc();
    const app = createAdminFeatureFlagRoutes(svc);
    const res = await app.request('/feature-x', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, rolloutPct: 150 }),
    });
    expect(res.status).toBe(400);
    expect(svc.setFeatureFlag).not.toHaveBeenCalled();
  });

  it('PUT /:key killSwitch + allowedTenants 可选字段合法', async () => {
    const svc = mockSvc();
    const app = createAdminFeatureFlagRoutes(svc);
    const res = await app.request('/feature-x', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false, killSwitch: true }),
    });
    expect(res.status).toBe(200);
    expect(svc.setFeatureFlag).toHaveBeenCalledWith(
      'feature-x',
      expect.objectContaining({ enabled: false, killSwitch: true })
    );
  });
});
