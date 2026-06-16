import { Hono } from 'hono';
import { z } from 'zod';
import type { SystemConfigService } from '../../contexts/system-config/system-config-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';

interface ConfigItemDef {
  value: unknown;
  source: 'config' | 'env';
  description: string;
  options?: string[];
  nullable?: boolean;
}

const CONFIG_SCHEMA: Record<string, ConfigItemDef> = {
  'tenant.maxAgents': {
    value: null,
    source: 'config',
    description: '每租户最大 Agent 数',
    nullable: true,
  },
  'tenant.maxUsers': {
    value: null,
    source: 'config',
    description: '每租户最大用户数',
    nullable: true,
  },
  'tenant.maxInstances': {
    value: null,
    source: 'config',
    description: '每租户最大实例数',
    nullable: true,
  },
  'tenant.maxConcurrentInstances': {
    value: null,
    source: 'config',
    description: '每租户最大并发实例数',
    nullable: true,
  },
  'resource.totalCpuMillis': {
    value: 8000,
    source: 'config',
    description: '租户 CPU 总量上限 (millicores)',
    nullable: true,
  },
  'resource.totalMemoryMB': {
    value: 8192,
    source: 'config',
    description: '租户内存总量上限 (MB)',
    nullable: true,
  },
  'resource.totalStorageGB': {
    value: 20,
    source: 'config',
    description: '租户存储总量上限 (GB)',
    nullable: true,
  },
  'resource.instanceCpu': {
    value: '500m',
    source: 'config',
    description: '单实例默认 CPU',
    options: ['250m', '500m', '1000m', '2000m', '4000m'],
  },
  'resource.instanceMemory': {
    value: '512Mi',
    source: 'config',
    description: '单实例默认内存',
    options: ['256Mi', '512Mi', '1Gi', '2Gi', '4Gi', '8Gi'],
  },
  'resource.instanceStorage': {
    value: '2Gi',
    source: 'config',
    description: '单实例默认存储',
    options: ['1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi'],
  },
  'resource.knowledgeBaseSizeMB': {
    value: null,
    source: 'config',
    description: '知识库存储上限 (MB)',
    nullable: true,
  },
  'resource.dataRetentionDays': {
    value: 90,
    source: 'config',
    description: '数据保留天数',
    nullable: true,
  },
  'resource.maxWebhooks': {
    value: 10,
    source: 'config',
    description: 'Webhook 数量上限',
    nullable: true,
  },
  'ai.tokenBudgetMonthly': {
    value: 1000000,
    source: 'config',
    description: '月度 Token 预算',
    nullable: true,
  },
  'ai.tokenBudgetDaily': {
    value: 50000,
    source: 'config',
    description: '日度 Token 预算',
    nullable: true,
  },
  'ai.apiCallsDaily': {
    value: 10000,
    source: 'config',
    description: '日 API 调用上限',
    nullable: true,
  },
  'ai.rateLimitPerMinute': {
    value: 60,
    source: 'config',
    description: 'AI Gateway 全局 RPM 上限',
    nullable: true,
  },
  'gateway.maxRPM': { value: 200, source: 'config', description: '网关全局 RPM 硬上限' },
  'gateway.timeout': { value: 30, source: 'config', description: 'AI 请求超时秒数' },
  'security.sessionTTL': { value: 7200, source: 'config', description: '会话有效期（秒）' },
  'security.maxLoginAttempts': { value: 5, source: 'config', description: '最大连续登录失败次数' },
  'security.passwordMinLength': { value: 8, source: 'config', description: '密码最小长度' },
  'feature.sso': { value: false, source: 'env', description: 'SSO 单点登录' },
  'feature.auditLog': { value: true, source: 'env', description: '审计日志' },
  'feature.multiRegion': { value: false, source: 'env', description: '多区域部署' },
  'feature.aiGateway': { value: true, source: 'config', description: 'AI Gateway 功能' },
  'feature.knowledgeBase': { value: true, source: 'config', description: '知识库功能' },
  'feature.matrixIntegration': {
    value: false,
    source: 'config',
    description: 'Matrix 即时通讯集成',
  },
  'feature.customTools': { value: true, source: 'config', description: '自定义 MCP 工具' },
  'notification.emailEnabled': { value: false, source: 'config', description: '邮件通知' },
  'notification.webhookEnabled': { value: true, source: 'config', description: 'Webhook 推送' },
};

function coerce(def: ConfigItemDef, dbValue: string): unknown {
  if (def.nullable && (dbValue === '' || dbValue === 'null')) return null;
  if (typeof def.value === 'number') return Number(dbValue) || def.value;
  if (def.value === null) return /^\d+$/.test(dbValue) ? Number(dbValue) : dbValue;
  if (typeof def.value === 'boolean') return dbValue === 'true';
  return dbValue;
}

const updateConfigSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export function createPlatformConfigRoutes(configSvc: SystemConfigService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const dbConfig = await configSvc.listSystemConfigs();
    const config: Record<string, ConfigItemDef> = {};
    for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
      const dbVal = dbConfig[key];
      config[key] = dbVal !== undefined ? { ...def, value: coerce(def, dbVal) } : { ...def };
    }
    return c.json({ config });
  });

  app.put('/', async (c) => {
    const parsed = await parseBody(c, updateConfigSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const stringified: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      stringified[k] = String(v);
    }
    await configSvc.batchSetSystemConfigs(stringified);
    return c.json({ success: true });
  });

  return app;
}
