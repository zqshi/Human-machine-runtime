import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { servicePlans } from '../schema/plan.js';
import type { Plan } from '../../contexts/tenant-management/domain/plan.js';

export interface IPlanRepository {
  listPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | null>;
  getPlanBySlug(slug: string): Promise<Plan | null>;
  savePlan(plan: Plan): Promise<void>;
  deletePlan(id: string): Promise<void>;
}

export class PlanRepository implements IPlanRepository {
  constructor(private db: Database) {}

  async listPlans(): Promise<Plan[]> {
    const rows = await this.db.select().from(servicePlans).orderBy(servicePlans.displayOrder);
    return rows.map(toPlanDomain);
  }

  async getPlan(id: string): Promise<Plan | null> {
    const [row] = await this.db.select().from(servicePlans).where(eq(servicePlans.id, id)).limit(1);
    return row ? toPlanDomain(row) : null;
  }

  async getPlanBySlug(slug: string): Promise<Plan | null> {
    const [row] = await this.db
      .select()
      .from(servicePlans)
      .where(eq(servicePlans.slug, slug))
      .limit(1);
    return row ? toPlanDomain(row) : null;
  }

  async savePlan(plan: Plan): Promise<void> {
    const values = toPlanRow(plan);
    await this.db
      .insert(servicePlans)
      .values(values)
      .onConflictDoUpdate({ target: servicePlans.id, set: values });
  }

  async deletePlan(id: string): Promise<void> {
    await this.db.delete(servicePlans).where(eq(servicePlans.id, id));
  }
}

function toPlanDomain(row: typeof servicePlans.$inferSelect): Plan {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    displayOrder: row.displayOrder,
    description: row.description ?? null,
    isDefault: row.isDefault,
    status: row.status as Plan['status'],
    quotaTemplate: (row.quotaTemplate ?? {}) as unknown as Plan['quotaTemplate'],
    featureTemplate: (row.featureTemplate ?? {}) as unknown as Plan['featureTemplate'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPlanRow(p: Plan) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    displayOrder: p.displayOrder,
    description: p.description,
    isDefault: p.isDefault,
    status: p.status,
    quotaTemplate: p.quotaTemplate as unknown as Record<string, unknown>,
    featureTemplate: p.featureTemplate as unknown as Record<string, boolean>,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  };
}
