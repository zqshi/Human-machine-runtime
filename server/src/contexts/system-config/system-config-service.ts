import type { ConfigRepository } from '../../db/repositories/config-repository.js';

const DEFAULT_OPENCLAW_CONFIG = {
  runtime: { openclawImage: '', openclawRuntimeVersion: 'v2', openclawSourcePath: '' },
  permissionTemplate: { commandAllowlist: [], approvalByRisk: {} },
  retention: {
    auditLogTtlDays: 90,
    auditLogMaxRows: 100000,
    archiveEnabled: true,
    archiveRingSize: 10,
  },
};

const DEFAULT_SEDIMENTATION_POLICY = {
  mode: 'auto',
  minConfidence: 0.8,
  minRepeated: 3,
  fallback: 'ignore',
  overrides: [],
};

export class SystemConfigService {
  constructor(private configRepo: ConfigRepository) {}

  async listSystemConfigs(): Promise<Record<string, string>> {
    const rows = await this.configRepo.listSystemConfigs();
    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return config;
  }

  async batchSetSystemConfigs(entries: Record<string, string>) {
    for (const [key, value] of Object.entries(entries)) {
      await this.configRepo.setSystemConfig(key, String(value));
    }
  }

  async getSedimentationPolicy() {
    const row = await this.configRepo.getPlatformConfig('skill-sedimentation-policy');
    return row?.value ?? DEFAULT_SEDIMENTATION_POLICY;
  }

  async setSedimentationPolicy(policy: Record<string, unknown>) {
    await this.configRepo.setPlatformConfig('skill-sedimentation-policy', policy);
  }

  async getOpenclawConfig() {
    const row = await this.configRepo.getPlatformConfig('openclaw-config');
    return row?.value ?? DEFAULT_OPENCLAW_CONFIG;
  }

  async setOpenclawConfig(config: Record<string, unknown>) {
    await this.configRepo.setPlatformConfig('openclaw-config', config);
  }

  async listOpenclawConfigSnapshots() {
    const row = await this.configRepo.getPlatformConfig('openclaw-config-snapshots');
    return (row?.value as unknown as unknown[]) ?? [];
  }

  async restoreOpenclawConfigSnapshot(snapshotId: string): Promise<boolean> {
    const row = await this.configRepo.getPlatformConfig('openclaw-config-snapshots');
    const snapshots = (row?.value as unknown as Record<string, unknown>[]) ?? [];
    const snapshot = snapshots.find((s) => s.id === snapshotId);
    if (!snapshot?.config) return false;
    await this.configRepo.setPlatformConfig('openclaw-config', snapshot.config);
    return true;
  }

  /**
   * 模型授权拦截灰度开关。
   * - off: 不校验（默认，兼容现状）
   * - log: 校验并记录未授权调用，但不拦截（可观测期）
   * - enforce: 校验并拒绝未授权调用（默认关闭的强制期）
   */
  async getAiGatewayEnforceMode(): Promise<'off' | 'log' | 'enforce'> {
    const row = await this.configRepo.getSystemConfig('aiGateway.enforceModelGrants');
    const v = (row?.value || 'off').toLowerCase();
    return v === 'log' || v === 'enforce' ? v : 'off';
  }

  async setAiGatewayEnforceMode(mode: 'off' | 'log' | 'enforce') {
    await this.configRepo.setSystemConfig('aiGateway.enforceModelGrants', mode);
  }

  /* ---------- v1.9: Feature Flag (#13 灰度发布) ---------- */

  async getFeatureFlags(): Promise<Record<string, FeatureFlagConfig>> {
    const row = await this.configRepo.getPlatformConfig('feature-flags');
    return (row?.value as Record<string, FeatureFlagConfig>) ?? {};
  }

  async getFeatureFlag(key: string): Promise<FeatureFlagConfig | null> {
    const flags = await this.getFeatureFlags();
    return flags[key] ?? null;
  }

  async setFeatureFlag(key: string, config: FeatureFlagConfig): Promise<void> {
    const flags = await this.getFeatureFlags();
    flags[key] = config;
    await this.configRepo.setPlatformConfig('feature-flags', flags);
  }

  /**
   * 判断 flag 对某租户是否启用。
   * 优先级:killSwitch(false=立即停) > 未配置(false) > allowedTenants(白名单) > rolloutPct(确定性 hash 灰度) > enabled。
   * 确定性灰度:同一 tenantId 结果稳定(hash % 100),不依赖随机。
   */
  async isFeatureEnabled(key: string, tenantId?: string): Promise<boolean> {
    const flag = await this.getFeatureFlag(key);
    if (!flag) return false;
    if (flag.killSwitch === false) return false;
    if (flag.allowedTenants && tenantId && flag.allowedTenants.includes(tenantId)) return true;
    if (flag.rolloutPct && flag.rolloutPct > 0 && tenantId) {
      return simpleHash(tenantId) % 100 < flag.rolloutPct;
    }
    return flag.enabled ?? false;
  }
}

/** v1.9: Feature Flag 配置(#13) */
export interface FeatureFlagConfig {
  enabled: boolean;
  /** 灰度比例 0-100(确定性 hash 灰度,同 tenantId 结果稳定) */
  rolloutPct?: number;
  /** 白名单租户(始终启用,优先于 rolloutPct) */
  allowedTenants?: string[];
  /** 紧急关闭(false=立即停,优先级最高) */
  killSwitch?: boolean;
}

/** 确定性字符串 hash(灰度判断用,不依赖 Math.random) */
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
