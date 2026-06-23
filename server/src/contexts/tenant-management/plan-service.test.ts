import { describe, it, expect, vi } from 'vitest';
import { PlanService } from './plan-service.js';
import type { IPlanRepository } from '../../db/repositories/plan-repository.js';
import type { Plan } from './domain/plan.js';
import { PLAN_STATUS } from './domain/plan.js';

/** In-memory IPlanRepository mock,便于隔离测试 PlanService 的业务逻辑。 */
function makeRepo(opts?: { plans?: Plan[] }): {
  repo: IPlanRepository;
  plans: Plan[];
} {
  const plans = [...(opts?.plans ?? [])];
  return {
    plans,
    repo: {
      async listPlans(opts?: { limit?: number; offset?: number }): Promise<Plan[]> {
        const limit = opts?.limit ?? 100;
        const offset = opts?.offset ?? 0;
        return plans.slice(offset, offset + limit);
      },
      async getPlan(id: string): Promise<Plan | null> {
        return plans.find((p) => p.id === id) ?? null;
      },
      async getPlanBySlug(slug: string): Promise<Plan | null> {
        return plans.find((p) => p.slug === slug) ?? null;
      },
      async savePlan(plan: Plan): Promise<void> {
        const idx = plans.findIndex((p) => p.id === plan.id);
        if (idx >= 0) plans[idx] = plan;
        else plans.push(plan);
      },
      async deletePlan(id: string): Promise<void> {
        const idx = plans.findIndex((p) => p.id === id);
        if (idx >= 0) plans.splice(idx, 1);
      },
    },
  };
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    name: 'Free',
    slug: 'free',
    displayOrder: 1,
    description: null,
    isDefault: true,
    status: PLAN_STATUS.ACTIVE,
    quotaTemplate: {} as Plan['quotaTemplate'],
    featureTemplate: {} as Plan['featureTemplate'],
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('PlanService', () => {
  it('list 默认 limit=100(避免无限制全量返回)', async () => {
    // 复现 §7.2.1 规则 2:列表必须分页,默认非空
    const many = Array.from({ length: 150 }, (_, i) =>
      makePlan({ id: `plan-${i + 1}`, slug: `plan-${i + 1}`, displayOrder: i + 1 })
    );
    const { repo } = makeRepo({ plans: many });
    const service = new PlanService(repo);
    const result = await service.list();
    expect(result).toHaveLength(100);
  });

  it('list 支持 offset 翻页', async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      makePlan({ id: `plan-${i + 1}`, slug: `plan-${i + 1}`, displayOrder: i + 1 })
    );
    const { repo } = makeRepo({ plans: many });
    const service = new PlanService(repo);
    const page1 = await service.list({ limit: 10, offset: 0 });
    const page2 = await service.list({ limit: 10, offset: 10 });
    const page3 = await service.list({ limit: 10, offset: 20 });
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3).toHaveLength(5);
    const allIds = [...page1, ...page2, ...page3].map((p) => p.id);
    expect(new Set(allIds).size).toBe(25);
  });

  it('list 透传 limit+offset 给 repository', async () => {
    const listSpy = vi.fn(async () => []);
    const repo: IPlanRepository = {
      listPlans: listSpy,
      async getPlan() {
        return null;
      },
      async getPlanBySlug() {
        return null;
      },
      async savePlan() {},
      async deletePlan() {},
    };
    const service = new PlanService(repo);
    await service.list({ limit: 50, offset: 30 });
    expect(listSpy).toHaveBeenCalledWith({ limit: 50, offset: 30 });
  });

  it('getById 不存在时抛 PLAN_NOT_FOUND', async () => {
    const { repo } = makeRepo();
    const service = new PlanService(repo);
    await expect(service.getById('missing')).rejects.toThrow(/plan not found/);
  });

  it('create 时 slug 冲突抛 PLAN_SLUG_CONFLICT', async () => {
    const existing = makePlan({ slug: 'free' });
    const { repo } = makeRepo({ plans: [existing] });
    const service = new PlanService(repo);
    await expect(service.create({ name: 'Free2', slug: 'free' })).rejects.toThrow(/already exists/);
  });

  it('delete 时若套餐被租户引用抛 PLAN_IN_USE', async () => {
    const existing = makePlan({ slug: 'free' });
    const { repo } = makeRepo({ plans: [existing] });
    const tenantChecker = {
      countByPlan: vi.fn(async () => 3),
    };
    const service = new PlanService(repo, tenantChecker);
    await expect(service.delete('plan-1')).rejects.toThrow(/3 tenant\(s\) using it/);
    expect(tenantChecker.countByPlan).toHaveBeenCalledWith('free');
  });

  it('update 已归档套餐抛 PLAN_ARCHIVED', async () => {
    const archived = makePlan({ status: PLAN_STATUS.ARCHIVED });
    const { repo } = makeRepo({ plans: [archived] });
    const service = new PlanService(repo);
    await expect(service.update('plan-1', { name: 'New' })).rejects.toThrow(/archived/);
  });
});
