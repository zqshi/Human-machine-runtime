import { desc, sql, and, gte, lte } from 'drizzle-orm';
import type { Database } from '../../client.js';
import { costRecords } from '../../schema/ai-gateway.js';
import { instances } from '../../schema/instance.js';
import { endOfDay } from './helpers.js';

export async function insertCostRecord(
  db: Database,
  data: {
    traceId: string;
    userId?: string;
    model: string;
    providerType: string;
    promptTokens: number;
    completionTokens: number;
    inputPrice?: number;
    outputPrice?: number;
    currency?: string;
    exchangeRate?: number;
    costOriginal: number;
    costCny: number;
  }
) {
  const [row] = await db
    .insert(costRecords)
    .values({
      traceId: data.traceId,
      userId: data.userId ?? null,
      model: data.model,
      providerType: data.providerType,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      inputPrice: data.inputPrice ?? 0,
      outputPrice: data.outputPrice ?? 0,
      currency: data.currency ?? 'USD',
      exchangeRate: data.exchangeRate ?? 7.2,
      costOriginal: data.costOriginal,
      costCny: data.costCny,
    })
    .returning();
  return row!;
}

export async function getCostSummary(db: Database) {
  const [row] = await db
    .select({
      totalCostCny: sql<number>`coalesce(sum(cost_cny), 0)::real`,
      totalPromptTokens: sql<number>`coalesce(sum(prompt_tokens), 0)::int`,
      totalCompletionTokens: sql<number>`coalesce(sum(completion_tokens), 0)::int`,
      recordCount: sql<number>`count(*)::int`,
    })
    .from(costRecords);

  return {
    totalCostCny: row?.totalCostCny ?? 0,
    totalPromptTokens: row?.totalPromptTokens ?? 0,
    totalCompletionTokens: row?.totalCompletionTokens ?? 0,
    recordCount: row?.recordCount ?? 0,
  };
}

export async function getCostAnalysis(db: Database, filters?: { dateFrom?: string; dateTo?: string }) {
  const conditions = [];
  if (filters?.dateFrom) conditions.push(gte(costRecords.createdAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(costRecords.createdAt, endOfDay(filters.dateTo)));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totals] = await db
    .select({
      totalPromptTokens: sql<number>`coalesce(sum(prompt_tokens), 0)::int`,
      totalCompletionTokens: sql<number>`coalesce(sum(completion_tokens), 0)::int`,
      totalEstimatedCost: sql<number>`coalesce(sum(cost_cny), 0)::real`,
    })
    .from(costRecords)
    .where(whereClause);

  const userRows = await db
    .select({
      userId: costRecords.userId,
      count: sql<number>`count(*)::int`,
      totalTokens: sql<number>`(coalesce(sum(prompt_tokens),0)+coalesce(sum(completion_tokens),0))::int`,
      estimatedCost: sql<number>`coalesce(sum(cost_cny),0)::real`,
    })
    .from(costRecords)
    .where(whereClause)
    .groupBy(costRecords.userId)
    .orderBy(desc(sql`sum(cost_cny)`));

  const modelRows = await db
    .select({
      model: costRecords.model,
      count: sql<number>`count(*)::int`,
      totalTokens: sql<number>`(coalesce(sum(prompt_tokens),0)+coalesce(sum(completion_tokens),0))::int`,
      estimatedCost: sql<number>`coalesce(sum(cost_cny),0)::real`,
    })
    .from(costRecords)
    .where(whereClause)
    .groupBy(costRecords.model)
    .orderBy(desc(sql`sum(cost_cny)`));

  const dailyRows = await db
    .select({
      day: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(prompt_tokens),0)::int`,
      completionTokens: sql<number>`coalesce(sum(completion_tokens),0)::int`,
      estimatedCost: sql<number>`coalesce(sum(cost_cny),0)::real`,
    })
    .from(costRecords)
    .where(whereClause)
    .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
    .orderBy(desc(sql`to_char(created_at, 'YYYY-MM-DD')`))
    .limit(30);

  const instanceRows = await db
    .select({
      creator: instances.creator,
      enterpriseUserId: instances.enterpriseUserId,
      department: instances.department,
    })
    .from(instances);

  const userDeptMap = new Map<string, string>();
  for (const inst of instanceRows) {
    const dept = inst.department || '未设置';
    if (inst.creator) userDeptMap.set(inst.creator, dept);
    if (inst.enterpriseUserId) userDeptMap.set(inst.enterpriseUserId, dept);
  }

  const deptMap = new Map<
    string,
    { users: Set<string>; count: number; totalTokens: number; estimatedCost: number }
  >();
  for (const u of userRows) {
    const dept = userDeptMap.get(u.userId ?? '') || '未分配';
    let entry = deptMap.get(dept);
    if (!entry) {
      entry = { users: new Set(), count: 0, totalTokens: 0, estimatedCost: 0 };
      deptMap.set(dept, entry);
    }
    entry.users.add(u.userId ?? 'unknown');
    entry.count += u.count;
    entry.totalTokens += u.totalTokens;
    entry.estimatedCost += u.estimatedCost;
  }
  const deptSummary = [...deptMap.entries()].map(([department, d]) => ({
    department,
    users: d.users.size,
    count: d.count,
    totalTokens: d.totalTokens,
    estimatedCost: Math.round(d.estimatedCost * 100) / 100,
  }));

  return {
    totalPromptTokens: totals?.totalPromptTokens ?? 0,
    totalCompletionTokens: totals?.totalCompletionTokens ?? 0,
    totalEstimatedCost: totals?.totalEstimatedCost ?? 0,
    deptSummary,
    userSummary: userRows.map((u) => ({
      userId: u.userId ?? 'unknown',
      department: userDeptMap.get(u.userId ?? '') || '未分配',
      count: u.count,
      totalTokens: u.totalTokens,
      estimatedCost: Math.round(u.estimatedCost * 100) / 100,
    })),
    modelSummary: modelRows.map((m) => ({
      model: m.model,
      count: m.count,
      totalTokens: m.totalTokens,
      estimatedCost: Math.round(m.estimatedCost * 100) / 100,
    })),
    dailyTrend: dailyRows.map((d) => ({
      day: d.day,
      count: d.count,
      promptTokens: d.promptTokens,
      completionTokens: d.completionTokens,
      estimatedCost: Math.round(d.estimatedCost * 100) / 100,
    })),
  };
}
