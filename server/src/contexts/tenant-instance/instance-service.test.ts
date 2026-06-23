import { describe, it, expect, vi } from 'vitest';
import {
  InstanceService,
  type IInstanceRepository,
  type IInstanceProvisioner,
  type IAuditLogger,
  type ITenantQuotaLookup,
} from './instance-service.js';
import { createInstance, STATE, applyResourceConfig } from './domain/instance.js';
import type { TenantQuotas } from '../tenant-management/domain/tenant.js';

function makeInstance(overrides: Partial<ReturnType<typeof createInstance>> = {}) {
  const base = createInstance({
    tenantId: 'tn_1',
    name: '测试员工',
    source: 'manual',
    matrixRoomId: null,
    creator: 'admin',
    enterpriseUserId: null,
  });
  return { ...base, ...overrides };
}

function makeRepo(instances: ReturnType<typeof makeInstance>[] = []): IInstanceRepository {
  const store = new Map(instances.map((i) => [i.id, i]));
  return {
    findAll: vi.fn(async (tenantId?: string, resourceSource?: string) => {
      let all = Array.from(store.values());
      if (tenantId) all = all.filter((i) => i.tenantId === tenantId);
      if (resourceSource === 'custom') all = all.filter((i) => i.resources.source === 'custom');
      else if (resourceSource === 'tenant_default')
        all = all.filter((i) => i.resources.source !== 'custom');
      return all;
    }),
    findById: vi.fn(async (id: string) => store.get(id)),
    save: vi.fn(async (inst) => {
      const next = inst.version + 1;
      store.set(inst.id, { ...inst, version: next });
      return next;
    }),
    delete: vi.fn(async (id: string) => {
      store.delete(id);
    }),
  };
}

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

function makeQuotaLookup(): ITenantQuotaLookup {
  return { getQuotas: vi.fn(async () => STANDARD_QUOTAS) };
}

function makeProvisioner(shouldFail = false): IInstanceProvisioner {
  return {
    provision: vi.fn(async () => {
      if (shouldFail) throw new Error('provision failed');
      return { containerId: 'abc123' };
    }),
    teardown: vi.fn(async () => {}),
  };
}

describe('InstanceService', () => {
  describe('list', () => {
    it('returns all instances', async () => {
      const inst = makeInstance();
      const svc = new InstanceService(makeRepo([inst]));
      const list = await svc.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(inst.id);
    });

    it('filters by tenantId', async () => {
      const a = makeInstance({ tenantId: 'tn_1' });
      const b = makeInstance({ tenantId: 'tn_2' });
      const svc = new InstanceService(makeRepo([a, b]));
      const list = await svc.list('tn_1');
      expect(list).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('returns instance by id', async () => {
      const inst = makeInstance();
      const svc = new InstanceService(makeRepo([inst]));
      const result = await svc.get(inst.id);
      expect(result.id).toBe(inst.id);
    });

    it('throws 404 for unknown id', async () => {
      const svc = new InstanceService(makeRepo());
      await expect(svc.get('nope')).rejects.toThrow('instance not found');
    });
  });

  describe('createFromMatrix', () => {
    it('creates and saves an instance', async () => {
      const repo = makeRepo();
      const svc = new InstanceService(repo);
      const result = await svc.createFromMatrix({
        tenantId: 'tn_1',
        matrixUserId: '@bot:matrix.org',
        displayName: 'Bot',
        creator: 'admin',
      });
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Bot');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws for empty matrixUserId', async () => {
      const svc = new InstanceService(makeRepo());
      await expect(
        svc.createFromMatrix({ tenantId: 'tn_1', matrixUserId: '', creator: 'admin' })
      ).rejects.toThrow('matrixUserId is required');
    });
  });

  describe('quota enforcement on create', () => {
    /**
     * 构造一个已有 N 个实例的 repo,模拟租户当前实例数。
     * makeInstance 默认 tenantId='tn_1',与 STANDARD_QUOTAS.maxInstances=10 对齐。
     */
    function makeRepoWith(count: number): IInstanceRepository {
      const instances = Array.from({ length: count }, (_, i) =>
        makeInstance({ id: `inst-${i}`, tenantId: 'tn_1' })
      );
      return makeRepo(instances);
    }

    it('create throws QUOTA_EXCEEDED when at limit', async () => {
      const repo = makeRepoWith(10); // 已达上限 10
      const svc = new InstanceService(repo, undefined, undefined, makeQuotaLookup());
      await expect(
        svc.create({
          tenantId: 'tn_1',
          name: '新员工',
          source: 'manual',
          matrixRoomId: null,
          creator: 'admin',
          enterpriseUserId: null,
        })
      ).rejects.toThrow('quota exceeded: maxInstances');
    });

    it('create succeeds when one slot remains (boundary)', async () => {
      const repo = makeRepoWith(9); // 9 < 10,可创建
      const svc = new InstanceService(repo, undefined, undefined, makeQuotaLookup());
      const result = await svc.create({
        tenantId: 'tn_1',
        name: '新员工',
        source: 'manual',
        matrixRoomId: null,
        creator: 'admin',
        enterpriseUserId: null,
      });
      expect(result.id).toBeDefined();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('createFromMatrix throws QUOTA_EXCEEDED when at limit', async () => {
      const repo = makeRepoWith(10);
      const svc = new InstanceService(repo, undefined, undefined, makeQuotaLookup());
      await expect(
        svc.createFromMatrix({
          tenantId: 'tn_1',
          matrixUserId: '@new:matrix.org',
          creator: 'admin',
        })
      ).rejects.toThrow('quota exceeded: maxInstances');
    });

    it('create skips quota check when tenantQuotaLookup not injected (backward compat)', async () => {
      // 不注入 quotaLookup,即使预填 100 个实例也应放行
      const repo = makeRepoWith(100);
      const svc = new InstanceService(repo); // 无 quotaLookup
      const result = await svc.create({
        tenantId: 'tn_1',
        name: '新员工',
        source: 'manual',
        matrixRoomId: null,
        creator: 'admin',
        enterpriseUserId: null,
      });
      expect(result.id).toBeDefined();
    });

    it('create allowed when maxInstances = 0 (unlimited)', async () => {
      const repo = makeRepoWith(100);
      const unlimitedQuotas: TenantQuotas = { ...STANDARD_QUOTAS, maxInstances: 0 };
      const lookup: ITenantQuotaLookup = {
        getQuotas: vi.fn(async () => unlimitedQuotas),
      };
      const svc = new InstanceService(repo, undefined, undefined, lookup);
      const result = await svc.create({
        tenantId: 'tn_1',
        name: '新员工',
        source: 'manual',
        matrixRoomId: null,
        creator: 'admin',
        enterpriseUserId: null,
      });
      expect(result.id).toBeDefined();
    });
  });

  describe('start', () => {
    it('transitions requested → running without provisioner', async () => {
      const inst = makeInstance({ state: STATE.REQUESTED });
      const svc = new InstanceService(makeRepo([inst]));
      const result = await svc.start(inst.id);
      expect(result.state).toBe(STATE.RUNNING);
    });

    it('transitions through provisioning with provisioner', async () => {
      const inst = makeInstance({ state: STATE.REQUESTED });
      const prov = makeProvisioner();
      const svc = new InstanceService(makeRepo([inst]), prov);
      const result = await svc.start(inst.id);
      expect(result.state).toBe(STATE.RUNNING);
      expect(result.runtime).toEqual({ containerId: 'abc123' });
      expect(prov.provision).toHaveBeenCalledTimes(1);
    });

    it('sets failed state when provisioner throws', async () => {
      const inst = makeInstance({ state: STATE.REQUESTED });
      const prov = makeProvisioner(true);
      const svc = new InstanceService(makeRepo([inst]), prov);
      const result = await svc.start(inst.id);
      expect(result.state).toBe(STATE.FAILED);
      expect(result.lastError).toBe('provision failed');
    });

    it('rejects invalid state transition', async () => {
      const inst = makeInstance({ state: STATE.RUNNING });
      const svc = new InstanceService(makeRepo([inst]));
      await expect(svc.start(inst.id)).rejects.toThrow('cannot start instance');
    });
  });

  describe('stop', () => {
    it('transitions running → stopped', async () => {
      const inst = makeInstance({ state: STATE.RUNNING });
      const svc = new InstanceService(makeRepo([inst]));
      const result = await svc.stop(inst.id);
      expect(result.state).toBe(STATE.STOPPED);
    });

    it('calls provisioner teardown', async () => {
      const inst = makeInstance({ state: STATE.RUNNING });
      const prov = makeProvisioner();
      const svc = new InstanceService(makeRepo([inst]), prov);
      await svc.stop(inst.id);
      expect(prov.teardown).toHaveBeenCalledTimes(1);
    });

    it('rejects stop on stopped instance', async () => {
      const inst = makeInstance({ state: STATE.STOPPED });
      const svc = new InstanceService(makeRepo([inst]));
      await expect(svc.stop(inst.id)).rejects.toThrow('cannot stop instance');
    });
  });

  describe('rebuild', () => {
    it('reprovisions a running instance', async () => {
      const inst = makeInstance({ state: STATE.RUNNING });
      const prov = makeProvisioner();
      const svc = new InstanceService(makeRepo([inst]), prov);
      const result = await svc.rebuild(inst.id);
      expect(result.state).toBe(STATE.RUNNING);
      expect(prov.teardown).toHaveBeenCalledTimes(1);
      expect(prov.provision).toHaveBeenCalledTimes(1);
    });

    it('rejects rebuild during provisioning', async () => {
      const inst = makeInstance({ state: STATE.PROVISIONING });
      const svc = new InstanceService(makeRepo([inst]));
      await expect(svc.rebuild(inst.id)).rejects.toThrow('cannot rebuild while provisioning');
    });
  });

  describe('remove', () => {
    it('deletes the instance', async () => {
      const inst = makeInstance({ state: STATE.STOPPED });
      const repo = makeRepo([inst]);
      const svc = new InstanceService(repo);
      const result = await svc.remove(inst.id);
      expect(result.deleted).toBe(true);
      expect(repo.delete).toHaveBeenCalledWith(inst.id);
    });

    it('tears down running instance before delete', async () => {
      const inst = makeInstance({ state: STATE.RUNNING });
      const prov = makeProvisioner();
      const svc = new InstanceService(makeRepo([inst]), prov);
      await svc.remove(inst.id);
      expect(prov.teardown).toHaveBeenCalledTimes(1);
    });
  });

  describe('audit integration', () => {
    it('emits audit events on create', async () => {
      const audit: IAuditLogger = { log: vi.fn() };
      const svc = new InstanceService(makeRepo(), undefined, audit);
      await svc.createFromMatrix({ tenantId: 'tn_1', matrixUserId: '@x:y', creator: 'admin' });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'instance.created' })
      );
    });
  });

  describe('updateResources', () => {
    it('applies custom resource config', async () => {
      const inst = makeInstance();
      const quotaLookup = makeQuotaLookup();
      const svc = new InstanceService(makeRepo([inst]), undefined, undefined, quotaLookup);
      const result = await svc.updateResources(
        inst.id,
        {
          compute: { cpu: '1000m', memory: '1Gi', gpu: null },
        },
        'admin'
      );
      expect(result.resources.source).toBe('custom');
      expect(result.resources.compute.cpu).toBe('1000m');
      expect(result.resources.customizedBy).toBe('admin');
    });

    it('rejects config exceeding tenant limits', async () => {
      const inst = makeInstance();
      const quotaLookup = makeQuotaLookup();
      const svc = new InstanceService(makeRepo([inst]), undefined, undefined, quotaLookup);
      await expect(
        svc.updateResources(
          inst.id,
          {
            compute: { cpu: '4000m', memory: '8Gi', gpu: null },
          },
          'admin'
        )
      ).rejects.toThrow('resource validation failed');
    });

    it('rejects aggregate budget exceeding tenant limit', async () => {
      const a = makeInstance({ tenantId: 'tn_1' });
      const b = makeInstance({ tenantId: 'tn_1' });
      const repo = makeRepo([a, b]);
      const quotaLookup: ITenantQuotaLookup = {
        getQuotas: vi.fn(async () => ({ ...STANDARD_QUOTAS, tokenBudgetMonthly: 500 })),
      };
      const svc = new InstanceService(repo, undefined, undefined, quotaLookup);
      await expect(
        svc.updateResources(
          a.id,
          { budget: { monthlyLimitCny: 600, dailyLimitCny: null, alertThresholdPct: 80 } },
          'admin'
        )
      ).rejects.toThrow('aggregate budget');
    });

    it('allows aggregate budget within tenant limit', async () => {
      const a = makeInstance({ tenantId: 'tn_1' });
      const b = makeInstance({ tenantId: 'tn_1' });
      const repo = makeRepo([a, b]);
      const quotaLookup: ITenantQuotaLookup = {
        getQuotas: vi.fn(async () => ({ ...STANDARD_QUOTAS, tokenBudgetMonthly: 1000 })),
      };
      const svc = new InstanceService(repo, undefined, undefined, quotaLookup);
      const result = await svc.updateResources(
        a.id,
        { budget: { monthlyLimitCny: 400, dailyLimitCny: null, alertThresholdPct: 80 } },
        'admin'
      );
      expect(result.resources.budget.monthlyLimitCny).toBe(400);
    });

    it('works without quota lookup', async () => {
      const inst = makeInstance();
      const svc = new InstanceService(makeRepo([inst]));
      const result = await svc.updateResources(
        inst.id,
        {
          model: { primaryModel: 'gpt-4o', fallbackModels: [], maxConcurrency: 10 },
        },
        'admin'
      );
      expect(result.resources.model.primaryModel).toBe('gpt-4o');
    });
  });

  describe('resetResources', () => {
    it('resets to tenant defaults', async () => {
      const inst = makeInstance();
      const customized = applyResourceConfig(
        inst,
        { compute: { cpu: '2000m', memory: '4Gi', gpu: null } },
        'admin'
      );
      const quotaLookup = makeQuotaLookup();
      const svc = new InstanceService(makeRepo([customized]), undefined, undefined, quotaLookup);
      const result = await svc.resetResources(customized.id, 'admin');
      expect(result.resources.source).toBe('tenant_default');
      expect(result.resources.compute.cpu).toBe('1000m');
    });
  });

  describe('list with resourceSource filter', () => {
    it('filters by custom resources', async () => {
      const a = makeInstance({ tenantId: 'tn_1' });
      const b = applyResourceConfig(makeInstance({ tenantId: 'tn_1' }), {}, 'admin');
      const svc = new InstanceService(makeRepo([a, b]));
      const custom = await svc.list(undefined, 'custom');
      expect(custom).toHaveLength(1);
      expect(custom[0].resources.source).toBe('custom');
    });
  });
});
