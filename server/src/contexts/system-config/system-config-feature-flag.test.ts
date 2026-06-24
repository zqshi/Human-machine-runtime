import { describe, it, expect, vi } from 'vitest';
import { SystemConfigService } from './system-config-service.js';

function makeConfigRepoMock(flags: Record<string, unknown> = {}) {
  return {
    getPlatformConfig: vi.fn(async (key: string) =>
      key === 'feature-flags' ? { value: flags } : null
    ),
    setPlatformConfig: vi.fn(async () => undefined),
    listSystemConfigs: vi.fn(async () => []),
    getSystemConfig: vi.fn(async () => null),
    setSystemConfig: vi.fn(async () => undefined),
  };
}

describe('SystemConfigService feature flag (#13)', () => {
  it('未配置 flag → isFeatureEnabled=false', async () => {
    const svc = new SystemConfigService(makeConfigRepoMock() as never);
    expect(await svc.isFeatureEnabled('unknown')).toBe(false);
  });

  it('killSwitch=false → 立即停(优先级最高,即便 enabled=true)', async () => {
    const svc = new SystemConfigService(
      makeConfigRepoMock({ f1: { enabled: true, killSwitch: false } }) as never
    );
    expect(await svc.isFeatureEnabled('f1', 'tn1')).toBe(false);
  });

  it('allowedTenants 白名单命中 → true;未命中 → 走 rolloutPct/enabled', async () => {
    const svc = new SystemConfigService(
      makeConfigRepoMock({
        f1: { enabled: false, allowedTenants: ['tn1'], rolloutPct: 0 },
      }) as never
    );
    expect(await svc.isFeatureEnabled('f1', 'tn1')).toBe(true);
    expect(await svc.isFeatureEnabled('f1', 'tn2')).toBe(false);
  });

  it('rolloutPct 确定性灰度(同 tenantId 结果稳定)', async () => {
    const svc = new SystemConfigService(
      makeConfigRepoMock({ f1: { enabled: true, rolloutPct: 50 } }) as never
    );
    const r1 = await svc.isFeatureEnabled('f1', 'tn1');
    const r2 = await svc.isFeatureEnabled('f1', 'tn1');
    expect(r1).toBe(r2);
  });

  it('rolloutPct=100 → 全启用(任意 tenantId)', async () => {
    const svc = new SystemConfigService(
      makeConfigRepoMock({ f1: { enabled: true, rolloutPct: 100 } }) as never
    );
    expect(await svc.isFeatureEnabled('f1', 'any_tenant')).toBe(true);
  });

  it('enabled=false 且无 rolloutPct → false', async () => {
    const svc = new SystemConfigService(makeConfigRepoMock({ f1: { enabled: false } }) as never);
    expect(await svc.isFeatureEnabled('f1', 'tn1')).toBe(false);
  });

  it('enabled=true 且无 rolloutPct/tenantId → true', async () => {
    const svc = new SystemConfigService(makeConfigRepoMock({ f1: { enabled: true } }) as never);
    expect(await svc.isFeatureEnabled('f1')).toBe(true);
  });

  it('setFeatureFlag 持久化(调 setPlatformConfig 含新 flag)', async () => {
    const repo = makeConfigRepoMock({});
    const svc = new SystemConfigService(repo as never);
    await svc.setFeatureFlag('f1', { enabled: true, rolloutPct: 10 });
    expect(repo.setPlatformConfig).toHaveBeenCalledWith(
      'feature-flags',
      expect.objectContaining({ f1: { enabled: true, rolloutPct: 10 } })
    );
  });

  it('setFeatureFlag 保留已有 flag(merge 非 replace)', async () => {
    const repo = makeConfigRepoMock({ existing: { enabled: true } });
    const svc = new SystemConfigService(repo as never);
    await svc.setFeatureFlag('new', { enabled: false });
    expect(repo.setPlatformConfig).toHaveBeenCalledWith(
      'feature-flags',
      expect.objectContaining({
        existing: { enabled: true },
        new: { enabled: false },
      })
    );
  });
});
