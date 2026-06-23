import { AppError } from '../../shared/utils.js';
import {
  createPlan,
  updatePlan,
  PLAN_STATUS,
  type Plan,
  type CreatePlanInput,
} from './domain/plan.js';
import type { IPlanRepository } from '../../db/repositories/plan-repository.js';

export interface IPlanTenantChecker {
  countByPlan(planSlug: string): Promise<number>;
}

export class PlanService {
  constructor(
    private repo: IPlanRepository,
    private tenantChecker?: IPlanTenantChecker
  ) {}

  async list(opts?: { limit?: number; offset?: number }): Promise<Plan[]> {
    return this.repo.listPlans(opts);
  }

  async getById(id: string): Promise<Plan> {
    const plan = await this.repo.getPlan(id);
    if (!plan) throw new AppError('plan not found', 404, 'PLAN_NOT_FOUND');
    return plan;
  }

  async create(input: CreatePlanInput): Promise<Plan> {
    const existing = await this.repo.getPlanBySlug(input.slug);
    if (existing)
      throw new AppError(`slug "${input.slug}" already exists`, 409, 'PLAN_SLUG_CONFLICT');
    const plan = createPlan(input);
    await this.repo.savePlan(plan);
    return plan;
  }

  async update(id: string, patch: Partial<CreatePlanInput>): Promise<Plan> {
    const plan = await this.getById(id);
    if (plan.status === PLAN_STATUS.ARCHIVED)
      throw new AppError('cannot update archived plan', 400, 'PLAN_ARCHIVED');
    const updated = updatePlan(plan, patch);
    await this.repo.savePlan(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const plan = await this.getById(id);
    if (this.tenantChecker) {
      const count = await this.tenantChecker.countByPlan(plan.slug);
      if (count > 0)
        throw new AppError(`cannot delete plan: ${count} tenant(s) using it`, 409, 'PLAN_IN_USE');
    }
    await this.repo.deletePlan(id);
  }
}
