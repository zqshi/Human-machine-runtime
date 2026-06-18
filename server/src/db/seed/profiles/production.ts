import type { SeedData, SeedProfile } from '../types.js';

/**
 * 解析 seed 账号密码：优先读环境变量，缺失时 fallback 到演示弱口令并打印警告。
 * 生产部署必须通过 HMR_SEED_*_PASSWORD 注入真实密码（见 .env.example）。
 */
function resolveSeedPassword(envKey: string, fallback: string, label: string): string {
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;
  console.warn(
    `[seed:production] ⚠️ ${label} 密码未通过 ${envKey} 注入，使用弱默认值——仅限演示，生产部署必须注入真实密码`
  );
  return fallback;
}

export const seedData: SeedData = {
  users: [
    {
      username: 'admin',
      password: resolveSeedPassword('HMR_SEED_ADMIN_PASSWORD', 'admin123', '平台管理员'),
      role: 'platform_admin',
      scope: 'platform',
      displayName: '平台管理员',
      email: 'admin@example.com',
      tenantId: null,
    },
    {
      username: 'tenant_admin',
      password: resolveSeedPassword('HMR_SEED_TENANT_ADMIN_PASSWORD', 'tenant123', '租户管理员'),
      role: 'tenant_admin',
      scope: 'tenant',
      displayName: '租户管理员',
      email: 'ta@example.com',
      tenantId: 'default',
    },
    {
      username: 'ops',
      password: resolveSeedPassword('HMR_SEED_OPS_PASSWORD', 'ops123', '运维操作员'),
      role: 'tenant_ops',
      scope: 'tenant',
      displayName: '运维操作员',
      email: 'ops@example.com',
      tenantId: 'default',
    },
    {
      username: 'auditor',
      password: resolveSeedPassword('HMR_SEED_AUDITOR_PASSWORD', 'audit123', '审计员'),
      role: 'tenant_auditor',
      scope: 'tenant',
      displayName: '审计员',
      email: 'auditor@example.com',
      tenantId: 'default',
    },
    // 模拟通过生产 OIDC 登录的用户 — 生产环境中无 RBAC 角色
    {
      username: 'alice.chen',
      password: '',
      role: 'tenant_ops',
      scope: 'tenant',
      displayName: 'Alice Chen',
      email: 'alice.chen@example.com',
      tenantId: 'default',
      source: 'oidc-mock',
    },
    {
      username: 'bob.smith',
      password: '',
      role: 'tenant_ops',
      scope: 'tenant',
      displayName: 'Bob Smith',
      email: 'bob.smith@example.com',
      tenantId: 'default',
      source: 'oidc-mock',
    },
    {
      username: 'carol.lee',
      password: '',
      role: 'tenant_ops',
      scope: 'tenant',
      displayName: 'Carol Lee',
      email: 'carol.lee@example.com',
      tenantId: 'default',
      source: 'oidc-mock',
    },
  ],

  tenant: {
    id: 'default',
    name: 'Demo Digital Employee Platform',
    slug: 'demo-platform',
    plan: 'enterprise',
    status: 'active',
    industry: 'technology',
    companySize: 'large',
    contactName: 'Platform Ops Team',
    contactEmail: 'ops@example.com',
    description: '企业级 AI 数字员工平台（生产环境镜像）',
    quotas: {
      maxInstances: 100,
      maxConcurrentInstances: 50,
      maxUsers: 500,
      totalCpuMillis: 128000,
      totalMemoryMB: 131072,
      totalStorageGB: 500,
      instanceCpu: '2000m',
      instanceMemory: '2Gi',
      instanceStorage: '10Gi',
      knowledgeBaseSizeMB: 10240,
      tokenBudgetMonthly: 50000000,
      tokenBudgetDaily: 2000000,
      apiCallsDaily: 200000,
      rateLimitPerMinute: 300,
      dataRetentionDays: 365,
      maxWebhooks: 50,
    },
    features: {
      aiGateway: true,
      knowledgeBase: true,
      matrixIntegration: false,
      customTools: true,
    },
    modelAccess: { allowedProviders: ['anthropic', 'zhipu', 'qwen', 'xiaomi', 'google'] },
  },

  instances: [],

  systemConfigs: [
    { key: 'platform.name', value: 'Digital Employee Platform', description: '平台名称' },
    { key: 'platform.version', value: '1.0.0', description: '平台版本（生产）' },
    { key: 'auth.sso.enabled', value: 'true', description: 'SSO 开关（生产环境已启用）' },
    { key: 'auth.sso.provider', value: 'oidc', description: 'SSO 提供商' },
    {
      key: 'auth.sso.issuer_url',
      value: 'https://oidc.cloud.example.com',
      description: 'OIDC Issuer',
    },
    { key: 'auth.sso.client_id', value: '[configured]', description: 'OIDC Client ID（已配置）' },
    {
      key: 'auth.sso.callback_url',
      value: 'https://app.cloud.example.com/api/v1/auth/callback',
      description: 'SSO 回调',
    },
    {
      key: 'auth.default_provider',
      value: 'platform-be-proxy',
      description: '默认认证方式（生产用 OIDC）',
    },
    { key: 'credential.encryption_key_version', value: '1', description: '凭证加密密钥版本' },
    { key: 'channel.matrix.enabled', value: 'false', description: 'Matrix 通道（生产未使用）' },
    { key: 'channel.wps.enabled', value: 'true', description: '协作通道（生产主要入口）' },
    { key: 'channel.websocket.enabled', value: 'true', description: 'WebSocket 通道' },
  ],
};

export const profile: SeedProfile = {
  name: 'production',
  seed: seedData,
};
