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
}
