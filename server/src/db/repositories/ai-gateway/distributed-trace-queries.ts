import { eq, desc, sql, asc, and, like, or, gte, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Database } from '../../client.js';
import { aiTraces, aiRiskHits, distributedTraces } from '../../schema/ai-gateway.js';
import { endOfDay } from './helpers.js';

export async function listDistributedTraces(
  db: Database,
  filters?: {
    status?: string;
    userId?: string;
    instanceId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = Math.max(1, filters?.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters?.limit ?? 50));
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filters?.status) conditions.push(eq(distributedTraces.status, filters.status));
  if (filters?.userId) conditions.push(eq(distributedTraces.userId, filters.userId));
  if (filters?.instanceId) conditions.push(eq(distributedTraces.instanceId, filters.instanceId));
  if (filters?.dateFrom) conditions.push(gte(distributedTraces.createdAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(distributedTraces.createdAt, endOfDay(filters.dateTo)));
  if (filters?.search) {
    const q = `%${filters.search}%`;
    conditions.push(
      or(
        like(distributedTraces.traceId, q),
        like(distributedTraces.userId, q),
        like(distributedTraces.instanceId, q),
        like(distributedTraces.rootOperation, q)
      )!
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(distributedTraces)
    .where(where)
    .orderBy(desc(distributedTraces.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(distributedTraces)
    .where(where);

  return { items: rows, total: countRow?.count ?? 0, page };
}

export async function getDistributedTraceDetail(db: Database, traceId: string) {
  const [trace] = await db
    .select()
    .from(distributedTraces)
    .where(eq(distributedTraces.traceId, traceId))
    .limit(1);
  if (!trace) return null;

  // 查询该 Trace 下所有 Span（ai_traces）
  const spans = await db
    .select()
    .from(aiTraces)
    .where(eq(aiTraces.distTraceId, traceId))
    .orderBy(asc(aiTraces.startTime), asc(aiTraces.createdAt));

  // 构建 Span 树
  const spanList = spans.map((span) => ({
    spanId: span.traceId,
    parentId: span.parentSpanId ?? null,
    operationName: span.operationName ?? 'llm.call',
    spanKind: span.spanKind ?? 'internal',
    startTime: (span.startTime ?? span.createdAt)?.toISOString() ?? null,
    durationMs: span.latencyMs ?? 0,
    status: span.status,
    depth: 0,
    tags: (span.metadata as Record<string, unknown>) ?? null,
    // 附加信息
    model: span.actualModel ?? span.requestedModel,
    providerType: span.providerType,
    promptTokens: span.promptTokens,
    completionTokens: span.completionTokens,
    estimatedCost: span.estimatedCost,
  }));

  // 计算 depth
  const spanMap = new Map(spanList.map((s) => [s.spanId, s]));
  const computeDepth = (spanId: string, visited: Set<string>): number => {
    if (visited.has(spanId)) return 0;
    visited.add(spanId);
    const span = spanMap.get(spanId);
    if (!span || !span.parentId || !spanMap.has(span.parentId)) return 0;
    return 1 + computeDepth(span.parentId, visited);
  };
  for (const item of spanList) {
    item.depth = computeDepth(item.spanId, new Set());
  }

  // 查询风险命中
  const riskHits = await db
    .select()
    .from(aiRiskHits)
    .where(
      sql`${aiRiskHits.traceId} IN (${sql.join(
        spans.map((s) => sql`${s.traceId}`),
        sql`, `
      )})`
    )
    .orderBy(asc(aiRiskHits.createdAt));

  return {
    ...trace,
    spanList,
    riskHits: riskHits.map((hit) => ({
      ruleId: hit.ruleId,
      ruleName: hit.ruleName,
      severity: hit.severity,
      action: hit.action,
      matchSummary: hit.matchSummary,
      createdAt: hit.createdAt,
    })),
  };
}

export async function insertDistributedTrace(
  db: Database,
  data: {
    traceId: string;
    rootOperation?: string;
    userId?: string;
    instanceId?: string;
    sessionId?: string;
    tags?: Record<string, unknown>;
  }
) {
  const [row] = await db
    .insert(distributedTraces)
    .values({
      traceId: data.traceId,
      rootOperation: data.rootOperation ?? 'unknown',
      userId: data.userId ?? null,
      instanceId: data.instanceId ?? null,
      sessionId: data.sessionId ?? null,
      tags: data.tags ?? null,
    })
    .onConflictDoNothing({ target: distributedTraces.traceId })
    .returning();
  return row ?? null;
}

export async function updateDistributedTrace(
  db: Database,
  traceId: string,
  patch: Partial<{
    spanCount: number;
    status: string;
    totalTokens: number;
    totalCost: number;
    totalDurationMs: number;
    completedAt: Date;
  }>
) {
  const [row] = await db
    .update(distributedTraces)
    .set(patch)
    .where(eq(distributedTraces.traceId, traceId))
    .returning();
  return row ?? null;
}
