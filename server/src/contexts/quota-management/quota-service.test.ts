import { describe, it, expect, vi } from 'vitest';
import { QuotaService } from './quota-service.js';
import type { QuotaRepository } from '../../db/repositories/quota-repository.js';

function makeRepo(): QuotaRepository {
  return {
    listRules: vi.fn(async () => []),
    getRuleById: vi.fn(async () => null),
    createRule: vi.fn(async (_tid: string, input: Record<string, unknown>) => ({
      id: 1,
      tenantId: 't1',
      resourceType: input.resourceType,
      thresholdPct: input.thresholdPct,
      severity: input.severity ?? 'warning',
      notifyChannels: input.notifyChannels ?? ['in_app'],
      enabled: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })),
    updateRule: vi.fn(async () => ({
      id: 1,
      tenantId: 't1',
      resourceType: 'instance_count',
      thresholdPct: 90,
      severity: 'critical',
      notifyChannels: ['in_app'],
      enabled: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })),
    deleteRule: vi.fn(async () => true),
    listEvents: vi.fn(async () => []),
    createEvent: vi.fn(async () => ({
      id: 1,
      tenantId: 't1',
      ruleId: 1,
      resourceType: 'instance_count',
      currentPct: 80,
      thresholdPct: 75,
      severity: 'warning',
      status: 'active',
      triggeredAt: '2026-01-01T00:00:00Z',
      resolvedAt: null,
    })),
    acknowledgeEvent: vi.fn(async () => ({
      id: 1,
      tenantId: 't1',
      ruleId: 1,
      resourceType: 'instance_count',
      currentPct: 80,
      thresholdPct: 75,
      severity: 'warning',
      status: 'acknowledged',
      triggeredAt: '2026-01-01T00:00:00Z',
      resolvedAt: null,
    })),
    resolveEvent: vi.fn(async () => null),
    countActiveEvents: vi.fn(async () => ({ active: 0, acknowledged: 0 })),
    saveSnapshot: vi.fn(async () => {}),
    getUsageHistory: vi.fn(async () => []),
  } as unknown as QuotaRepository;
}

function makeTenantLookup(quotas: Record<string, number> = {}) {
  return {
    getById: vi.fn(async () => ({
      name: '测试租户',
      quotas: {
        maxInstances: 10,
        tokenBudgetMonthly: 1_000_000,
        totalStorageGB: 5,
        apiCallsDaily: 10_000,
        ...quotas,
      },
    })),
  };
}

function makeInstanceLookup(count = 3) {
  const instances = Array.from({ length: count }, (_, i) => ({
    id: `inst-${i}`,
    name: `员工${i}`,
    state: 'running',
    tenantId: 't1',
    resources: {
      source: i === 0 ? 'custom' : 'tenant_default',
      compute: { cpu: '500m', memory: '512Mi' },
      budget: { monthlyLimitCny: 100 },
      storage: { persistentVolumeSize: '2Gi' },
    },
  }));
  return { list: vi.fn(async () => instances) };
}

function makeTokenLookup(tokens = 500_000) {
  return {
    getUsageSummary: vi.fn(async () => ({
      totalTokens: tokens,
      totalCost: 12.5,
      requestCount: 3000,
    })),
  };
}

describe('QuotaService', () => {
  describe('getDashboard', () => {
    it('returns usage items for all resource types', async () => {
      const svc = new QuotaService(
        makeRepo(),
        makeTenantLookup(),
        makeInstanceLookup(3),
        makeTokenLookup()
      );
      const result = await svc.getDashboard('t1');

      expect(result.tenantId).toBe('t1');
      expect(result.items.length).toBe(4);

      const instanceItem = result.items.find((i) => i.resourceType === 'instance_count');
      expect(instanceItem).toBeDefined();
      expect(instanceItem!.current).toBe(3);
      expect(instanceItem!.limit).toBe(10);
      expect(instanceItem!.usagePct).toBe(30);

      const tokenItem = result.items.find((i) => i.resourceType === 'token_monthly');
      expect(tokenItem).toBeDefined();
      expect(tokenItem!.current).toBe(500_000);
      expect(tokenItem!.usagePct).toBe(50);
    });

    it('fires alerts when threshold exceeded', async () => {
      const repo = makeRepo();
      (repo.listRules as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 1,
          tenantId: 't1',
          resourceType: 'instance_count',
          thresholdPct: 20,
          severity: 'warning',
          notifyChannels: ['in_app'],
          enabled: true,
        },
      ]);

      const svc = new QuotaService(
        repo,
        makeTenantLookup(),
        makeInstanceLookup(3),
        makeTokenLookup()
      );
      await svc.getDashboard('t1');

      expect(repo.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          resourceType: 'instance_count',
          ruleId: 1,
        })
      );
    });

    it('skips disabled rules', async () => {
      const repo = makeRepo();
      (repo.listRules as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 1,
          tenantId: 't1',
          resourceType: 'instance_count',
          thresholdPct: 20,
          severity: 'warning',
          notifyChannels: [],
          enabled: false,
        },
      ]);

      const svc = new QuotaService(
        repo,
        makeTenantLookup(),
        makeInstanceLookup(3),
        makeTokenLookup()
      );
      await svc.getDashboard('t1');

      expect(repo.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('getAllocation', () => {
    it('returns allocation summary', async () => {
      const svc = new QuotaService(
        makeRepo(),
        makeTenantLookup(),
        makeInstanceLookup(3),
        makeTokenLookup()
      );
      const result = await svc.getAllocation('t1');
      expect(result.rows).toHaveLength(3);
      expect(result.totals.instanceCount).toBe(3);
      expect(result.totals.instanceLimit).toBe(10);
      expect(result.totals.budgetAllocated).toBe(300);
    });
  });

  describe('alert rules CRUD', () => {
    it('creates a rule', async () => {
      const repo = makeRepo();
      const svc = new QuotaService(
        repo,
        makeTenantLookup(),
        makeInstanceLookup(),
        makeTokenLookup()
      );
      const rule = await svc.createRule('t1', {
        resourceType: 'instance_count',
        thresholdPct: 80,
      });
      expect(rule.thresholdPct).toBe(80);
      expect(repo.createRule).toHaveBeenCalled();
    });

    it('rejects invalid threshold', async () => {
      const svc = new QuotaService(
        makeRepo(),
        makeTenantLookup(),
        makeInstanceLookup(),
        makeTokenLookup()
      );
      await expect(
        svc.createRule('t1', { resourceType: 'instance_count', thresholdPct: 150 })
      ).rejects.toThrow('thresholdPct must be 1-100');
    });

    it('deletes a rule', async () => {
      const repo = makeRepo();
      const svc = new QuotaService(
        repo,
        makeTenantLookup(),
        makeInstanceLookup(),
        makeTokenLookup()
      );
      await svc.deleteRule(1);
      expect(repo.deleteRule).toHaveBeenCalledWith(1);
    });

    it('throws 404 on delete nonexistent', async () => {
      const repo = makeRepo();
      (repo.deleteRule as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const svc = new QuotaService(
        repo,
        makeTenantLookup(),
        makeInstanceLookup(),
        makeTokenLookup()
      );
      await expect(svc.deleteRule(999)).rejects.toThrow('rule not found');
    });
  });

  describe('acknowledgeEvent', () => {
    it('acknowledges an event', async () => {
      const repo = makeRepo();
      const svc = new QuotaService(
        repo,
        makeTenantLookup(),
        makeInstanceLookup(),
        makeTokenLookup()
      );
      const event = await svc.acknowledgeEvent(1);
      expect(event.status).toBe('acknowledged');
    });

    it('throws 404 for nonexistent event', async () => {
      const repo = makeRepo();
      (repo.acknowledgeEvent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const svc = new QuotaService(
        repo,
        makeTenantLookup(),
        makeInstanceLookup(),
        makeTokenLookup()
      );
      await expect(svc.acknowledgeEvent(999)).rejects.toThrow('event not found');
    });
  });
});
