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
  setDesiredState,
  bumpSpecGeneration,
  hasStateDrift,
  decideReconcileAction,
  getReconciledSpecGeneration,
  getReconcileFailures,
  withReconciled,
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

describe('desiredState / specGeneration (v1.8 reconcile)', () => {
  it('createInstance defaults desiredState to REQUESTED and specGeneration to 0', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    expect(inst.desiredState).toBe(STATE.REQUESTED);
    expect(inst.specGeneration).toBe(0);
  });

  it('createInstance keeps desiredState in sync with state (no drift at birth)', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    expect(inst.desiredState).toBe(inst.state);
    expect(hasStateDrift(inst)).toBe(false);
  });

  it('setDesiredState updates desired without touching actual state', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    const updated = setDesiredState(inst, STATE.STOPPED);
    expect(updated.desiredState).toBe(STATE.STOPPED);
    expect(updated.state).toBe(STATE.REQUESTED); // actual 不变
    expect(updated).not.toBe(inst); // 不可变返回新对象
  });

  it('setDesiredState records a drift against actual state', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    const drifted = setDesiredState(inst, STATE.RUNNING);
    expect(hasStateDrift(drifted)).toBe(true);
  });

  it('bumpSpecGeneration increments generation monotonically', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    expect(inst.specGeneration).toBe(0);
    expect(bumpSpecGeneration(inst).specGeneration).toBe(1);
    expect(bumpSpecGeneration(bumpSpecGeneration(inst)).specGeneration).toBe(2);
  });

  it('hasStateDrift is false once actual catches up to desired', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'Test', creator: 'admin' });
    const drifted = setDesiredState(inst, STATE.RUNNING);
    expect(hasStateDrift(drifted)).toBe(true);
    // actual 跟随 desired 后,drift 消除
    const reconciled = { ...drifted, state: STATE.RUNNING };
    expect(hasStateDrift(reconciled)).toBe(false);
  });
});

describe('reconcile runtime helpers (v1.8)', () => {
  it('getReconciledSpecGeneration returns -1 when unset', () => {
    const inst = createInstance({ tenantId: 'tn_1', name: 'T', creator: 'a' });
    expect(getReconciledSpecGeneration(inst)).toBe(-1);
  });
  it('getReconciledSpecGeneration returns stored value', () => {
    const inst = {
      ...createInstance({ tenantId: 'tn_1', name: 'T', creator: 'a' }),
      runtime: { reconciledSpecGeneration: 5 },
    };
    expect(getReconciledSpecGeneration(inst)).toBe(5);
  });
  it('getReconcileFailures returns 0 when unset', () => {
    expect(
      getReconcileFailures(createInstance({ tenantId: 'tn_1', name: 'T', creator: 'a' }))
    ).toBe(0);
  });
  it('withReconciled stamps generation, resets failures, clears error, keeps rest', () => {
    const rt = withReconciled({ pid: 1, lastReconcileError: 'x', reconcileFailures: 2 }, 3);
    expect(rt.reconciledSpecGeneration).toBe(3);
    expect(rt.reconcileFailures).toBe(0);
    expect(rt.lastReconcileError).toBeUndefined();
    expect(rt.pid).toBe(1);
  });
});

describe('decideReconcileAction (v1.8)', () => {
  const base = () => createInstance({ tenantId: 'tn_1', name: 'T', creator: 'a' });

  it('returns stop when desired=stopped but actual running', () => {
    const inst = { ...base(), state: STATE.RUNNING, desiredState: STATE.STOPPED };
    expect(decideReconcileAction(inst)).toBe('stop');
  });

  it('returns start when desired=running but actual requested', () => {
    const inst = { ...base(), state: STATE.REQUESTED, desiredState: STATE.RUNNING };
    expect(decideReconcileAction(inst)).toBe('start');
  });

  it('returns start when desired=running but actual stopped', () => {
    const inst = { ...base(), state: STATE.STOPPED, desiredState: STATE.RUNNING };
    expect(decideReconcileAction(inst)).toBe('start');
  });

  it('returns noop when desired=running and provisioning in flight (do not disturb)', () => {
    const inst = { ...base(), state: STATE.PROVISIONING, desiredState: STATE.RUNNING };
    expect(decideReconcileAction(inst)).toBe('noop');
  });

  it('returns reconcile when spec drifted while running', () => {
    const inst = {
      ...base(),
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 2,
      runtime: { reconciledSpecGeneration: 1 },
    };
    expect(decideReconcileAction(inst)).toBe('reconcile');
  });

  it('returns reconcile when specGeneration never reconciled (running)', () => {
    const inst = {
      ...base(),
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 0,
      runtime: {},
    };
    expect(decideReconcileAction(inst)).toBe('reconcile');
  });

  it('returns noop when spec already reconciled', () => {
    const inst = {
      ...base(),
      state: STATE.RUNNING,
      desiredState: STATE.RUNNING,
      specGeneration: 2,
      runtime: { reconciledSpecGeneration: 2 },
    };
    expect(decideReconcileAction(inst)).toBe('noop');
  });

  it('returns noop when desired=stopped and actual already stopped', () => {
    const inst = { ...base(), state: STATE.STOPPED, desiredState: STATE.STOPPED };
    expect(decideReconcileAction(inst)).toBe('noop');
  });
});
