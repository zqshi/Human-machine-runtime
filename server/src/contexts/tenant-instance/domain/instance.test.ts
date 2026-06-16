import { describe, it, expect } from 'vitest';
import {
  createInstance,
  touch,
  normalizeMatrixLocalpart,
  inferDepartmentByJob,
  generateEmployeeNo,
  STATE,
  defaultResourceConfig,
  resourceConfigFromTenantQuotas,
  validateResourceConfig,
  applyResourceConfig,
  resetResourceConfig,
  isCustomResource,
} from './instance.js';
import type { TenantQuotas } from '../../tenant-management/domain/tenant.js';

describe('normalizeMatrixLocalpart', () => {
  it('strips @ prefix and :server suffix', () => {
    expect(normalizeMatrixLocalpart('@alice:matrix.org')).toBe('alice');
  });
  it('returns localpart if no prefix or suffix', () => {
    expect(normalizeMatrixLocalpart('bob')).toBe('bob');
  });
  it('handles empty/null input', () => {
    expect(normalizeMatrixLocalpart(null)).toBe('');
    expect(normalizeMatrixLocalpart('')).toBe('');
    expect(normalizeMatrixLocalpart(undefined)).toBe('');
  });
  it('strips @ but keeps rest when no colon', () => {
    expect(normalizeMatrixLocalpart('@alice')).toBe('alice');
  });
});

describe('inferDepartmentByJob', () => {
  it('infers finance from 财务', () => {
    expect(inferDepartmentByJob('财务助手')).toBe('finance');
  });
  it('infers human-resources from 人事 or HR', () => {
    expect(inferDepartmentByJob('人事经理')).toBe('human-resources');
    expect(inferDepartmentByJob('HR助手')).toBe('human-resources');
  });
  it('infers engineering from 开发 or 工程', () => {
    expect(inferDepartmentByJob('开发助手')).toBe('engineering');
    expect(inferDepartmentByJob('工程师')).toBe('engineering');
  });
  it('returns general for empty or unknown', () => {
    expect(inferDepartmentByJob('')).toBe('general');
    expect(inferDepartmentByJob('行政总监')).toBe('general');
    expect(inferDepartmentByJob(null)).toBe('general');
  });
  it('infers procurement, legal, quality, sales, product', () => {
    expect(inferDepartmentByJob('采购专员')).toBe('procurement');
    expect(inferDepartmentByJob('法务顾问')).toBe('legal');
    expect(inferDepartmentByJob('测试工程师')).toBe('engineering');
    expect(inferDepartmentByJob('测试专员')).toBe('quality');
    expect(inferDepartmentByJob('销售代表')).toBe('sales');
    expect(inferDepartmentByJob('产品经理')).toBe('product');
  });
});

describe('generateEmployeeNo', () => {
  it('produces DE prefix with 12 digits', () => {
    const no = generateEmployeeNo();
    expect(no).toMatch(/^DE\d{12}$/);
  });
});

describe('createInstance', () => {
  it('creates an instance in REQUESTED state', () => {
    const inst = createInstance({
      tenantId: 'tn_1',
      name: '财务助手',
      creator: 'admin',
      jobTitle: '财务分析师',
    });
    expect(inst.state).toBe(STATE.REQUESTED);
    expect(inst.tenantId).toBe('tn_1');
    expect(inst.name).toBe('财务助手');
    expect(inst.department).toBe('finance');
    expect(inst.id).toMatch(/^inst_/);
    expect(inst.lastError).toBeNull();
  });

  it('uses default source from config', () => {
    const inst = createInstance(
      { tenantId: 'tn_1', name: 'Test', creator: 'admin' },
      { defaultSource: 'matrix' }
    );
    expect(inst.source).toBe('matrix');
  });

  it('uses explicit source over config default', () => {
    const inst = createInstance(
      { tenantId: 'tn_1', name: 'Test', creator: 'admin', source: 'api' },
      { defaultSource: 'matrix' }
    );
    expect(inst.source).toBe('api');
  });

  it('auto-generates employeeNo when not provided', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    expect(inst.employeeNo).toMatch(/^DE\d{12}$/);
    expect(inst.employeeId).toBe(inst.employeeNo);
  });

  it('uses provided employeeNo', () => {
    const inst = createInstance({
      tenantId: 'tn_1',
      name: 'Test',
      creator: 'admin',
      employeeNo: 'E001',
      employeeId: 'EID001',
    });
    expect(inst.employeeNo).toBe('E001');
    expect(inst.employeeId).toBe('EID001');
  });
});

describe('touch', () => {
  it('returns new object with updated timestamp', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    const touched = touch(inst);
    expect(touched).not.toBe(inst);
    expect(touched.id).toBe(inst.id);
    expect(typeof touched.updatedAt).toBe('string');
  });
});

const STANDARD_QUOTAS: TenantQuotas = {
  maxInstances: 10,
  maxConcurrentInstances: 5,
  maxUsers: 50,
  instanceCpu: '1000m',
  instanceMemory: '2Gi',
  instanceStorage: '5Gi',
  maxStorageMB: 10240,
  knowledgeBaseSizeMB: 1024,
  tokenBudgetMonthly: 1000000,
  tokenBudgetDaily: 50000,
  apiCallsDaily: 10000,
  rateLimitPerMinute: 60,
  dataRetentionDays: 90,
  maxWebhooks: 10,
};

describe('defaultResourceConfig', () => {
  it('returns tenant_default source', () => {
    const cfg = defaultResourceConfig();
    expect(cfg.source).toBe('tenant_default');
    expect(cfg.customizedAt).toBeNull();
    expect(cfg.compute.cpu).toBe('500m');
  });
});

describe('resourceConfigFromTenantQuotas', () => {
  it('maps tenant quotas to resource config', () => {
    const cfg = resourceConfigFromTenantQuotas(STANDARD_QUOTAS);
    expect(cfg.compute.cpu).toBe('1000m');
    expect(cfg.compute.memory).toBe('2Gi');
    expect(cfg.budget.monthlyLimitCny).toBe(1000000);
    expect(cfg.storage.persistentVolumeSize).toBe('5Gi');
    expect(cfg.source).toBe('tenant_default');
  });
});

describe('validateResourceConfig', () => {
  it('passes for valid config within tenant limits', () => {
    const cfg = defaultResourceConfig();
    const errors = validateResourceConfig(cfg, STANDARD_QUOTAS);
    expect(errors).toHaveLength(0);
  });

  it('fails when cpu exceeds tenant limit', () => {
    const cfg = {
      ...defaultResourceConfig(),
      compute: { cpu: '4000m', memory: '512Mi', gpu: null },
    };
    const errors = validateResourceConfig(cfg, STANDARD_QUOTAS);
    expect(errors.some((e) => e.field === 'compute.cpu')).toBe(true);
  });

  it('fails when memory exceeds tenant limit', () => {
    const cfg = { ...defaultResourceConfig(), compute: { cpu: '500m', memory: '8Gi', gpu: null } };
    const errors = validateResourceConfig(cfg, STANDARD_QUOTAS);
    expect(errors.some((e) => e.field === 'compute.memory')).toBe(true);
  });

  it('fails when maxConcurrency out of range', () => {
    const cfg = {
      ...defaultResourceConfig(),
      model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 0 },
    };
    const errors = validateResourceConfig(cfg, STANDARD_QUOTAS);
    expect(errors.some((e) => e.field === 'model.maxConcurrency')).toBe(true);
  });

  it('fails when budget is negative', () => {
    const cfg = {
      ...defaultResourceConfig(),
      budget: { monthlyLimitCny: -1, dailyLimitCny: null, alertThresholdPct: 80 },
    };
    const errors = validateResourceConfig(cfg, STANDARD_QUOTAS);
    expect(errors.some((e) => e.field === 'budget.monthlyLimitCny')).toBe(true);
  });
});

describe('applyResourceConfig', () => {
  it('marks source as custom with actor and timestamp', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    const updated = applyResourceConfig(
      inst,
      { compute: { cpu: '1000m', memory: '1Gi', gpu: null } },
      'admin'
    );
    expect(updated.resources.source).toBe('custom');
    expect(updated.resources.customizedBy).toBe('admin');
    expect(updated.resources.customizedAt).not.toBeNull();
    expect(updated.resources.compute.cpu).toBe('1000m');
  });
});

describe('resetResourceConfig', () => {
  it('resets to tenant defaults', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    const customized = applyResourceConfig(
      inst,
      { compute: { cpu: '2000m', memory: '4Gi', gpu: null } },
      'admin'
    );
    const reset = resetResourceConfig(customized, STANDARD_QUOTAS);
    expect(reset.resources.source).toBe('tenant_default');
    expect(reset.resources.compute.cpu).toBe('1000m');
    expect(reset.resources.customizedAt).toBeNull();
  });
});

describe('isCustomResource', () => {
  it('returns true for custom source', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    expect(isCustomResource(inst)).toBe(false);
    const customized = applyResourceConfig(inst, {}, 'admin');
    expect(isCustomResource(customized)).toBe(true);
  });
});
