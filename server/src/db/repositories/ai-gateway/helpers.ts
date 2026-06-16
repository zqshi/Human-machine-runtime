import { eq, and, like, or, gte, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { aiTraces } from '../../schema/ai-gateway.js';

/** 从 payload 对象中读取 durationMs（兼容历史链路写入）。 */
export function readDurationMs(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>).durationMs;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** 将日期字符串补到当天 23:59:59.999，用于闭区间 dateTo 过滤。 */
export function endOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

// ── Span 树构建 ──

export interface SpanItem {
  spanId: string;
  parentId: string | null;
  operationName: string;
  startTime: string | null;
  durationMs: number;
  status: string;
  depth: number;
  tags: Record<string, unknown> | null;
  nodeId: string;
  kind: string;
  model: string | null;
  summary: string | null;
  inputPayload: unknown;
  outputPayload: unknown;
}

export interface SpanNode extends SpanItem {
  children: SpanNode[];
}

export type FlowNodeRow = {
  nodeId: string;
  kind: string;
  title: string | null;
  model: string | null;
  status: string | null;
  summary: string | null;
  inputPayload: unknown;
  outputPayload: unknown;
  createdAt: Date;
  spanId: string | null;
  parentId: string | null;
  operationName: string | null;
  startTime: Date | null;
  durationMs: number | null;
  tags: unknown;
};

/** 根据 FlowNode 行列表构建扁平 spanList 与父子 spanTree。 */
export function buildSpanTree(nodes: FlowNodeRow[]): { spanList: SpanItem[]; spanTree: SpanNode[] } {
  if (nodes.length === 0) return { spanList: [], spanTree: [] };

  // 构建扁平 SpanItem 列表
  const items: SpanItem[] = nodes.map((node) => ({
    spanId: node.spanId ?? node.nodeId,
    parentId: node.parentId ?? null,
    operationName: node.operationName ?? node.title ?? node.kind,
    startTime: (node.startTime ?? node.createdAt)?.toISOString() ?? null,
    durationMs: node.durationMs ?? readDurationMs(node.outputPayload) ?? readDurationMs(node.inputPayload) ?? 0,
    status: node.status ?? 'unknown',
    depth: 0,
    tags: (node.tags as Record<string, unknown>) ?? null,
    nodeId: node.nodeId,
    kind: node.kind,
    model: node.model,
    summary: node.summary,
    inputPayload: node.inputPayload,
    outputPayload: node.outputPayload,
  }));

  // 根据 parentId 构建 depth
  const spanMap = new Map(items.map((s) => [s.spanId, s]));
  const computeDepth = (spanId: string, visited: Set<string>): number => {
    if (visited.has(spanId)) return 0; // 防环
    visited.add(spanId);
    const span = spanMap.get(spanId);
    if (!span || !span.parentId || !spanMap.has(span.parentId)) return 0;
    return 1 + computeDepth(span.parentId, visited);
  };
  for (const item of items) {
    item.depth = computeDepth(item.spanId, new Set());
  }

  // 构建树
  const nodeMap = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  for (const item of items) {
    nodeMap.set(item.spanId, { ...item, children: [] });
  }

  for (const item of items) {
    const treeNode = nodeMap.get(item.spanId)!;
    if (item.parentId && nodeMap.has(item.parentId)) {
      nodeMap.get(item.parentId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  // 按 startTime 排序
  const sortChildren = (nodes: SpanNode[]): void => {
    nodes.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return { spanList: items, spanTree: roots };
}

// ── Trace 过滤条件构造 ──

export interface TraceFilters {
  model?: string;
  status?: string;
  search?: string;
  userId?: string;
  instanceId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** 构建 aiTraces 列表过滤的 WHERE 子句（listTraces 与 getTraceStats 共用）。 */
export function buildTraceWhere(filters?: TraceFilters): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters?.model) {
    conditions.push(
      or(eq(aiTraces.requestedModel, filters.model), eq(aiTraces.actualModel, filters.model))!
    );
  }
  if (filters?.status) conditions.push(eq(aiTraces.status, filters.status));
  if (filters?.userId) conditions.push(eq(aiTraces.userId, filters.userId));
  if (filters?.instanceId) conditions.push(eq(aiTraces.instanceId, filters.instanceId));
  if (filters?.dateFrom) conditions.push(gte(aiTraces.createdAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(aiTraces.createdAt, endOfDay(filters.dateTo)));
  if (filters?.search) {
    const q = `%${filters.search}%`;
    conditions.push(
      or(
        like(aiTraces.traceId, q),
        like(aiTraces.requestId, q),
        like(aiTraces.sessionId, q),
        like(aiTraces.userId, q),
        like(aiTraces.instanceId, q),
        like(aiTraces.requestedModel, q),
        like(aiTraces.actualModel, q),
        sql`${aiTraces.metadata}::text ilike ${q}`
      )!
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}
