import { eq, desc, sql, asc, inArray, lt, and, gte, lte } from 'drizzle-orm';
import type { Database } from '../../client.js';
import { aiTraces, aiFlowNodes, aiRiskHits, costRecords } from '../../schema/ai-gateway.js';
import { buildSpanTree, buildTraceWhere, endOfDay, readDurationMs, type TraceFilters } from './helpers.js';

/** 删除 created_at < before 的 trace（按 trace_id 级联清理 flow_nodes/risk_hits/cost_records）。返回删除条数 */
export async function deleteTracesBefore(db: Database, before: Date): Promise<number> {
  const rows = await db
    .select({ traceId: aiTraces.traceId })
    .from(aiTraces)
    .where(lt(aiTraces.createdAt, before));
  if (rows.length === 0) return 0;
  const traceIds = rows.map((r) => r.traceId);
  await db.delete(aiFlowNodes).where(inArray(aiFlowNodes.traceId, traceIds));
  await db.delete(aiRiskHits).where(inArray(aiRiskHits.traceId, traceIds));
  await db.delete(costRecords).where(inArray(costRecords.traceId, traceIds));
  const deleted = await db.delete(aiTraces).where(inArray(aiTraces.traceId, traceIds)).returning();
  return deleted.length;
}

export async function listTraces(
  db: Database,
  filters?: TraceFilters & { page?: number; limit?: number }
) {
  const page = Math.max(1, filters?.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters?.limit ?? 50));
  const offset = (page - 1) * limit;
  const where = buildTraceWhere(filters);

  const rows = await db
    .select()
    .from(aiTraces)
    .where(where)
    .orderBy(desc(aiTraces.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiTraces)
    .where(where);

  return { items: rows, total: countRow?.count ?? 0, page };
}

export async function getTraceDetail(db: Database, traceId: string) {
  const [trace] = await db.select().from(aiTraces).where(eq(aiTraces.traceId, traceId)).limit(1);
  if (!trace) return null;

  const [flowNodes, riskHits] = await Promise.all([
    db.select().from(aiFlowNodes).where(eq(aiFlowNodes.traceId, traceId)).orderBy(asc(aiFlowNodes.createdAt)),
    db.select().from(aiRiskHits).where(eq(aiRiskHits.traceId, traceId)).orderBy(asc(aiRiskHits.createdAt)),
  ]);

  // ── chain（向下兼容旧格式） ──
  const chain = flowNodes.map((node) => ({
    nodeId: node.nodeId,
    kind: node.kind,
    stage: node.title || node.kind,
    title: node.title,
    model: node.model,
    status: node.status || 'unknown',
    summary: node.summary,
    inputPayload: node.inputPayload,
    outputPayload: node.outputPayload,
    createdAt: node.createdAt,
    durationMs: node.durationMs ?? readDurationMs(node.outputPayload) ?? readDurationMs(node.inputPayload) ?? 0,
  }));

  // ── Span 树构建（分布式追踪可观测性） ──
  const { spanList, spanTree } = buildSpanTree(flowNodes);

  return {
    ...trace,
    chain,
    spans: spanTree,
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

export async function getTraceStats(db: Database, filters?: { dateFrom?: string; dateTo?: string }) {
  const conditions = [];
  if (filters?.dateFrom) conditions.push(gte(aiTraces.createdAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(aiTraces.createdAt, endOfDay(filters.dateTo)));

  const [row] = await db
    .select({
      totalCalls: sql<number>`count(*)::int`,
      totalTokens: sql<number>`coalesce(sum(prompt_tokens + completion_tokens), 0)::int`,
      cacheReadTokens: sql<number>`coalesce(sum(cache_read_tokens), 0)::int`,
      cacheCreationTokens: sql<number>`coalesce(sum(cache_creation_tokens), 0)::int`,
      avgLatency: sql<number>`coalesce(avg(latency_ms), 0)::int`,
      completed: sql<number>`count(*) filter (where status in ('success', 'completed'))::int`,
      blocked: sql<number>`count(*) filter (where status = 'blocked')::int`,
      failed: sql<number>`count(*) filter (where status in ('error', 'failed'))::int`,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(aiTraces)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const total = row?.totalCount ?? 1;
  return {
    totalCalls: row?.totalCalls ?? 0,
    totalTokens: row?.totalTokens ?? 0,
    cacheReadTokens: row?.cacheReadTokens ?? 0,
    cacheCreationTokens: row?.cacheCreationTokens ?? 0,
    avgLatency: row?.avgLatency ?? 0,
    completed: row?.completed ?? 0,
    blocked: row?.blocked ?? 0,
    failed: row?.failed ?? 0,
    errorRate: total > 0 ? ((row?.failed ?? 0) / total) * 100 : 0,
  };
}

export async function insertTrace(
  db: Database,
  data: {
    traceId: string;
    sessionId: string;
    requestId: string;
    userId?: string;
    instanceId?: string;
    apiKeyHash?: string;
    requestedModel: string;
    actualModel?: string;
    providerType?: string;
    status: string;
    promptTokens: number;
    completionTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    latencyMs: number;
    inputCost?: number;
    outputCost?: number;
    estimatedCost?: number;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    completedAt?: Date;
    // ── 分布式追踪字段 ──
    distTraceId?: string;
    parentSpanId?: string;
    operationName?: string;
    spanKind?: string;
    startTime?: Date;
  }
) {
  const [row] = await db
    .insert(aiTraces)
    .values({
      traceId: data.traceId,
      sessionId: data.sessionId,
      requestId: data.requestId,
      userId: data.userId ?? null,
      instanceId: data.instanceId ?? null,
      apiKeyHash: data.apiKeyHash ?? null,
      requestedModel: data.requestedModel,
      actualModel: data.actualModel ?? null,
      providerType: data.providerType ?? null,
      status: data.status,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      cacheReadTokens: data.cacheReadTokens ?? 0,
      cacheCreationTokens: data.cacheCreationTokens ?? 0,
      latencyMs: data.latencyMs,
      inputCost: data.inputCost ?? 0,
      outputCost: data.outputCost ?? 0,
      estimatedCost: data.estimatedCost ?? 0,
      metadata: data.metadata ?? null,
      createdAt: data.createdAt ?? new Date(),
      completedAt: data.completedAt ?? null,
      distTraceId: data.distTraceId ?? null,
      parentSpanId: data.parentSpanId ?? null,
      operationName: data.operationName ?? 'llm.call',
      spanKind: data.spanKind ?? 'internal',
      startTime: data.startTime ?? data.createdAt ?? new Date(),
    })
    .onConflictDoNothing({ target: aiTraces.traceId })
    .returning();
  return row ?? null;
}

export async function traceExistsByRequestId(db: Database, requestId: string): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`1` })
    .from(aiTraces)
    .where(eq(aiTraces.requestId, requestId))
    .limit(1);
  return !!row;
}

