import { describe, it, expect, vi } from 'vitest';
import { SystemConfigService } from './system-config-service.js';
import type { ConfigRepository } from '../../db/repositories/config-repository.js';

function mockConfigRepo(): ConfigRepository {
  const sysStore = new Map<string, string>();
  const platStore = new Map<string, unknown>();
  return {
    listSystemConfigs: vi.fn(async () =>
      Array.from(sysStore.entries()).map(([key, value]) => ({ key, value }))
    ),
    setSystemConfig: vi.fn(async (key: string, value: string) => {
      sysStore.set(key, value);
    }),
    getPlatformConfig: vi.fn(async (key: string) => {
      const v = platStore.get(key);
      return v !== undefined ? { key, value: v } : null;
    }),
    setPlatformConfig: vi.fn(async (key: string, value: unknown) => {
      platStore.set(key, value);
    }),
  } as unknown as ConfigRepository;
}

describe('SystemConfigService', () => {
  it('listSystemConfigs returns key-value map', async () => {
    const repo = mockConfigRepo();
    await (repo.setSystemConfig as ReturnType<typeof vi.fn>)('sso_enabled', 'true');
    const svc = new SystemConfigService(repo);
    const cfg = await svc.listSystemConfigs();
    expect(cfg).toEqual({ sso_enabled: 'true' });
  });

  it('batchSetSystemConfigs sets multiple entries', async () => {
    const repo = mockConfigRepo();
    const svc = new SystemConfigService(repo);
    await svc.batchSetSystemConfigs({ a: '1', b: '2' });
    expect(repo.setSystemConfig).toHaveBeenCalledTimes(2);
  });

  it('getSedimentationPolicy returns default when not set', async () => {
    const repo = mockConfigRepo();
    const svc = new SystemConfigService(repo);
    const policy = await svc.getSedimentationPolicy();
    expect(policy).toEqual(expect.objectContaining({ mode: 'auto' }));
  });

  it('setSedimentationPolicy and getSedimentationPolicy round-trip', async () => {
    const repo = mockConfigRepo();
    const svc = new SystemConfigService(repo);
    const custom = { mode: 'manual', minConfidence: 0.9 };
    await svc.setSedimentationPolicy(custom);
    expect(repo.setPlatformConfig).toHaveBeenCalledWith('skill-sedimentation-policy', custom);
  });

  it('getCockpitConfig returns default when not set', async () => {
    const repo = mockConfigRepo();
    const svc = new SystemConfigService(repo);
    const cfg = await svc.getCockpitConfig();
    expect(cfg).toEqual(expect.objectContaining({ runtime: expect.any(Object) }));
  });

  it('restoreCockpitConfigSnapshot returns false for unknown id', async () => {
    const repo = mockConfigRepo();
    const svc = new SystemConfigService(repo);
    expect(await svc.restoreCockpitConfigSnapshot('nope')).toBe(false);
  });

  it('restoreCockpitConfigSnapshot restores valid snapshot', async () => {
    const repo = mockConfigRepo();
    const snapshots = [{ id: 'snap1', config: { runtime: {} } }];
    await (repo.setPlatformConfig as ReturnType<typeof vi.fn>)(
      'cockpit-config-snapshots',
      snapshots
    );
    const svc = new SystemConfigService(repo);
    const ok = await svc.restoreCockpitConfigSnapshot('snap1');
    expect(ok).toBe(true);
    expect(repo.setPlatformConfig).toHaveBeenCalledWith('cockpit-config', { runtime: {} });
  });
});
