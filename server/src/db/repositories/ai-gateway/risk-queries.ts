import { eq, asc } from 'drizzle-orm';
import type { Database } from '../../client.js';
import { riskRules } from '../../schema/ai-gateway.js';

export async function listRiskRules(db: Database) {
  return db.select().from(riskRules).orderBy(asc(riskRules.sortOrder));
}

export async function getRiskRule(db: Database, ruleId: string) {
  const [row] = await db
    .select()
    .from(riskRules)
    .where(eq(riskRules.ruleId, ruleId))
    .limit(1);
  return row ?? null;
}

export async function createRiskRule(
  db: Database,
  data: {
    ruleId: string;
    displayName: string;
    description?: string;
    pattern: string;
    severity: string;
    action: string;
    category?: string;
    isEnabled?: boolean;
    sortOrder?: number;
  }
) {
  const [row] = await db
    .insert(riskRules)
    .values({
      ruleId: data.ruleId,
      displayName: data.displayName,
      description: data.description ?? null,
      pattern: data.pattern,
      severity: data.severity,
      action: data.action,
      category: data.category ?? 'custom',
      isEnabled: data.isEnabled ?? true,
      sortOrder: data.sortOrder ?? 100,
    })
    .returning();
  return row!;
}

export async function updateRiskRule(
  db: Database,
  ruleId: string,
  patch: Partial<{
    displayName: string;
    description: string;
    pattern: string;
    severity: string;
    action: string;
    category: string;
    isEnabled: boolean;
    sortOrder: number;
  }>
) {
  const [row] = await db
    .update(riskRules)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(riskRules.ruleId, ruleId))
    .returning();
  return row ?? null;
}

export async function deleteRiskRule(db: Database, ruleId: string) {
  const [row] = await db.delete(riskRules).where(eq(riskRules.ruleId, ruleId)).returning();
  return !!row;
}

export async function toggleRiskRule(db: Database, ruleId: string) {
  const rule = await getRiskRule(db, ruleId);
  if (!rule) return null;
  const [row] = await db
    .update(riskRules)
    .set({ isEnabled: !rule.isEnabled, updatedAt: new Date() })
    .where(eq(riskRules.ruleId, ruleId))
    .returning();
  return row ?? null;
}
