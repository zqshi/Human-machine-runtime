import { eq, desc, and } from 'drizzle-orm';
import type { Database } from '../client.js';
import { evalEvaluators } from '../schema/eval-benchmark.js';

export class EvalEvaluatorRepository {
  constructor(private db: Database) {}

  /* ──── CRUD ──── */

  async listEvaluators(opts?: { type?: string; status?: string; tenantId?: string }) {
    const conditions = [];
    if (opts?.type) conditions.push(eq(evalEvaluators.type, opts.type));
    if (opts?.status) conditions.push(eq(evalEvaluators.status, opts.status));
    if (opts?.tenantId) conditions.push(eq(evalEvaluators.tenantId, opts.tenantId));

    return this.db
      .select()
      .from(evalEvaluators)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(evalEvaluators.createdAt));
  }

  async getEvaluator(id: string) {
    const [row] = await this.db
      .select()
      .from(evalEvaluators)
      .where(eq(evalEvaluators.id, id))
      .limit(1);
    return row ?? null;
  }

  async createEvaluator(data: {
    id: string;
    name: string;
    description?: string;
    type: string;
    dimensions: unknown;
    scoringRubric?: unknown;
    ruleConfig?: unknown;
    judgeConfig?: unknown;
    threshold?: number;
    tenantId?: string;
  }) {
    const [row] = await this.db
      .insert(evalEvaluators)
      .values({
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        dimensions: data.dimensions,
        scoringRubric: data.scoringRubric ?? [],
        ruleConfig: data.ruleConfig ?? null,
        judgeConfig: data.judgeConfig ?? null,
        threshold: data.threshold ?? 0.8,
        tenantId: data.tenantId ?? null,
      })
      .returning();
    return row!;
  }

  async updateEvaluator(
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      type: string;
      dimensions: unknown;
      scoringRubric: unknown;
      ruleConfig: unknown;
      judgeConfig: unknown;
      threshold: number;
      status: string;
    }>
  ) {
    const [row] = await this.db
      .update(evalEvaluators)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(evalEvaluators.id, id))
      .returning();
    return row ?? null;
  }

  async deleteEvaluator(id: string) {
    const [row] = await this.db
      .delete(evalEvaluators)
      .where(eq(evalEvaluators.id, id))
      .returning();
    return !!row;
  }
}
