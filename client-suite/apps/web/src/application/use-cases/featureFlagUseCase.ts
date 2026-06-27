/**
 * featureFlagUseCase — Feature Flag 用例编排(application 层,纯函数,依赖注入)。
 *
 * 复用 createOrganizationEmployee 模式:纯函数 + deps 注入(测试传 mock),
 * 不依赖 React。封装 infrastructure API 调用 + 业务规则(合并 PRESET_KEYS、
 * tenants 解析、draft 转换),presentation 层不再直调 infrastructure。
 *
 * T46(P1-5):presentation → infrastructure 直连重构范本。
 */
import { featureFlagApi, type FeatureFlagConfig } from '../services/adminApi';

type FeatureFlagApi = typeof featureFlagApi;

/** 预置关键 flag(管理后台始终展示,即使后端未配置) */
const PRESET_KEYS = ['agent.guardrails.enforce', 'tool.approval.enforce', 'agent.runtime.canary'];

/** 前端编辑草稿(含 key + tenantsInput 逗号分隔编辑态) */
export interface FlagDraft extends FeatureFlagConfig {
  key: string;
  tenantsInput: string;
}

function toDraft(key: string, flag: FeatureFlagConfig): FlagDraft {
  return {
    key,
    enabled: flag.enabled,
    rolloutPct: flag.rolloutPct,
    allowedTenants: flag.allowedTenants,
    killSwitch: flag.killSwitch,
    tenantsInput: (flag.allowedTenants ?? []).join(', '),
  };
}

export interface FeatureFlagUseCaseDeps {
  featureFlagApi: FeatureFlagApi;
}

const defaultDeps: FeatureFlagUseCaseDeps = { featureFlagApi };

/**
 * 列出所有 feature flag 草稿(后端配置 + 预置 key 合并,去重)。
 * 后端未配置的预置 key 以默认值(enabled:false)展示。
 */
export async function listFeatureFlags(
  deps: FeatureFlagUseCaseDeps = defaultDeps
): Promise<FlagDraft[]> {
  const r = await deps.featureFlagApi.list();
  const allKeys = new Set([...Object.keys(r.flags), ...PRESET_KEYS]);
  return Array.from(allKeys).map((k) =>
    r.flags[k] ? toDraft(k, r.flags[k]) : { key: k, enabled: false, tenantsInput: '' }
  );
}

/**
 * 保存 feature flag:解析 tenantsInput(逗号分隔 → 数组),构造 config,调 set。
 * 空 tenantsInput → allowedTenants undefined(不限白名单)。
 */
export async function saveFeatureFlag(
  draft: FlagDraft,
  deps: FeatureFlagUseCaseDeps = defaultDeps
): Promise<void> {
  const tenants = draft.tenantsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const config: FeatureFlagConfig = {
    enabled: draft.enabled,
    rolloutPct: draft.rolloutPct,
    allowedTenants: tenants.length ? tenants : undefined,
    killSwitch: draft.killSwitch,
  };
  await deps.featureFlagApi.set(draft.key, config);
}
