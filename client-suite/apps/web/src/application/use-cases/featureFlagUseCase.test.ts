import { describe, it, expect, vi } from 'vitest';
import { listFeatureFlags, saveFeatureFlag, type FlagDraft } from './featureFlagUseCase';
import type { FeatureFlagUseCaseDeps } from './featureFlagUseCase';

/**
 * featureFlagUseCase 单测 — 纯函数 + deps 注入(§2.2 application 用例级测试)。
 *
 * 验证业务规则:合并 PRESET_KEYS、tenants 解析、draft 转换、空 tenants→undefined。
 * mock featureFlagApi(不触网络),照 createOrganizationEmployee.test.ts 模式。
 */
function mockDeps(overrides: Partial<FeatureFlagUseCaseDeps> = {}): FeatureFlagUseCaseDeps {
  return {
    featureFlagApi: {
      list: vi.fn(),
      set: vi.fn(),
      ...overrides.featureFlagApi,
    } as never,
  };
}

describe('listFeatureFlags', () => {
  it('后端 flags + 预置 key 合并去重', async () => {
    const deps = mockDeps({
      featureFlagApi: {
        list: vi.fn().mockResolvedValue({
          flags: {
            'agent.guardrails.enforce': { enabled: true },
            'custom.flag': { enabled: false, rolloutPct: 50 },
          },
        }),
        set: vi.fn(),
      } as never,
    });
    const drafts = await listFeatureFlags(deps);
    const keys = drafts.map((d) => d.key);
    // 后端 2 个 + 预置 3 个(agent.guardrails.enforce 已在后端,去重) = 4
    expect(keys).toEqual(
      expect.arrayContaining([
        'agent.guardrails.enforce',
        'tool.approval.enforce',
        'agent.runtime.canary',
        'custom.flag',
      ])
    );
    expect(drafts).toHaveLength(4);
  });

  it('后端未配置的预置 key 以默认值展示(enabled:false)', async () => {
    const deps = mockDeps({
      featureFlagApi: { list: vi.fn().mockResolvedValue({ flags: {} }), set: vi.fn() } as never,
    });
    const drafts = await listFeatureFlags(deps);
    const preset = drafts.find((d) => d.key === 'tool.approval.enforce');
    expect(preset).toMatchObject({
      key: 'tool.approval.enforce',
      enabled: false,
      tenantsInput: '',
    });
  });

  it('allowedTenants 数组 → tenantsInput 逗号字符串(草稿转换)', async () => {
    const deps = mockDeps({
      featureFlagApi: {
        list: vi.fn().mockResolvedValue({
          flags: {
            'agent.runtime.canary': { enabled: true, allowedTenants: ['t1', 't2'] },
          },
        }),
        set: vi.fn(),
      } as never,
    });
    const drafts = await listFeatureFlags(deps);
    expect(drafts[0].tenantsInput).toBe('t1, t2');
  });
});

describe('saveFeatureFlag', () => {
  it('tenantsInput 非空 → 解析为数组 allowedTenants', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const deps = mockDeps({ featureFlagApi: { list: vi.fn(), set } as never });
    const draft: FlagDraft = {
      key: 'agent.guardrails.enforce',
      enabled: true,
      rolloutPct: 80,
      tenantsInput: 't1, t2 , t3',
      killSwitch: undefined,
    };
    await saveFeatureFlag(draft, deps);
    expect(set).toHaveBeenCalledWith('agent.guardrails.enforce', {
      enabled: true,
      rolloutPct: 80,
      allowedTenants: ['t1', 't2', 't3'],
      killSwitch: undefined,
    });
  });

  it('tenantsInput 空 → allowedTenants undefined(不限白名单)', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const deps = mockDeps({ featureFlagApi: { list: vi.fn(), set } as never });
    const draft: FlagDraft = {
      key: 'k',
      enabled: false,
      tenantsInput: '  ,  ',
      killSwitch: undefined,
    };
    await saveFeatureFlag(draft, deps);
    expect(set).toHaveBeenCalledWith('k', expect.objectContaining({ allowedTenants: undefined }));
  });

  it('killSwitch 透传', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const deps = mockDeps({ featureFlagApi: { list: vi.fn(), set } as never });
    await saveFeatureFlag({ key: 'k', enabled: true, tenantsInput: '', killSwitch: false }, deps);
    expect(set).toHaveBeenCalledWith('k', expect.objectContaining({ killSwitch: false }));
  });
});
