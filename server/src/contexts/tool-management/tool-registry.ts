/**
 * Tool Registry — 工具注册中心端口
 *
 * 参考微服务「服务注册/发现」机制：把工具源/定义视为可注册的服务，统一封装
 * 注册、发现、健康检查、调用编排。
 *
 * 本文件是 domain 端口：纯类型 + 纯函数 + 接口契约，零运行时外部依赖（仅 import type）。
 * application 层（tool-registry-service.ts）实现 IToolRegistry，复用
 * ToolSource/Definition/CallLog repository + executor-factory + parsers。
 * 管理页路由、Agent 运行时、外部调用方均经此端口；executeTool 收口到 invoke。
 */
import type {
  CreateSourceInput,
  ExecutionContext,
  ExecutionResult,
  ExecutionType,
  SourceStatus,
  SourceType,
} from './types.js';

// ─────────────────────────────────────────────
// 健康（参考服务健康检查）
// ─────────────────────────────────────────────

export type ToolHealthStatus = 'healthy' | 'degraded' | 'unknown' | 'down';

export interface ToolHealthRecord {
  sourceId: string;
  status: ToolHealthStatus;
  /** epoch ms，null 表示从未探活 */
  lastCheckAt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
}

/** 由连续失败次数推导健康状态（domain 纯逻辑，供 healthCheckAll 复用）。 */
export function computeHealthStatus(
  consecutiveFailures: number,
  thresholds: { degraded: number; down: number } = { degraded: 1, down: 3 }
): ToolHealthStatus {
  if (consecutiveFailures >= thresholds.down) return 'down';
  if (consecutiveFailures >= thresholds.degraded) return 'degraded';
  return 'healthy';
}

// ─────────────────────────────────────────────
// 发现（参考服务发现）
// ─────────────────────────────────────────────

export interface ToolEndpoint {
  definitionId: string;
  sourceId: string;
  tenantId: string;
  name: string;
  description: string | null;
  executionType: ExecutionType;
  inputSchema: Record<string, unknown> | null;
  tags: string[];
  enabled: boolean;
}

export interface ToolDiscoveryQuery {
  tenantId: string;
  sourceId?: string;
  executionType?: ExecutionType;
  /** 命中需同时含全部指定 tag（AND） */
  tags?: string[];
  keyword?: string;
  enabledOnly?: boolean;
}

/** 端点是否匹配发现查询（domain 纯逻辑，供 discover 实现复用）。 */
export function matchDiscoveryQuery(endpoint: ToolEndpoint, query: ToolDiscoveryQuery): boolean {
  if (endpoint.tenantId !== query.tenantId) return false;
  if (query.enabledOnly && !endpoint.enabled) return false;
  if (query.sourceId && endpoint.sourceId !== query.sourceId) return false;
  if (query.executionType && endpoint.executionType !== query.executionType) return false;
  if (query.tags && query.tags.length > 0) {
    if (!query.tags.every((t) => endpoint.tags.includes(t))) return false;
  }
  if (query.keyword) {
    const kw = query.keyword.toLowerCase();
    const haystack = `${endpoint.name} ${endpoint.description ?? ''}`.toLowerCase();
    if (!haystack.includes(kw)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// 调用（全链路收口）
// ─────────────────────────────────────────────

export interface ToolInvocationRequest {
  /** tool definition id */
  toolId: string;
  params: Record<string, unknown>;
  context: ExecutionContext;
}

export interface ToolInvocationResult extends ExecutionResult {
  /** tool_call_logs 行 id */
  logId: string;
  /** v1.9:#7 审批 gate 拦截时返回(需人工审批后续执行,见 ApprovalGate) */
  pendingApproval?: { approvalId: string; reason: string };
}

/** 端点当前是否可调用：须启用且非 down（domain 纯逻辑）。 */
export function canInvoke(endpoint: ToolEndpoint, health: ToolHealthStatus): boolean {
  if (!endpoint.enabled) return false;
  return health !== 'down';
}

// ─────────────────────────────────────────────
// 注册（参考服务注册）
// ─────────────────────────────────────────────

export interface ToolSourceDescriptor {
  id: string;
  tenantId: string;
  sourceType: SourceType;
  name: string;
  status: SourceStatus;
  toolCount: number;
  health: ToolHealthStatus;
}

// ─────────────────────────────────────────────
// 端口
// ─────────────────────────────────────────────

/**
 * IToolRegistry — 工具注册中心端口。
 * application 层实现；消费方（管理页 route、Agent 运行时）只依赖此抽象，不耦合具体 service。
 */
export interface IToolRegistry {
  /** 注册工具源（同步后工具定义落库）。 */
  registerSource(
    input: CreateSourceInput,
    tenantId: string,
    createdBy?: string
  ): Promise<ToolSourceDescriptor>;
  /** 注销工具源（级联清理定义）。 */
  deregisterSource(sourceId: string): Promise<void>;
  /** 按查询条件发现可用工具端点。 */
  discover(query: ToolDiscoveryQuery): Promise<ToolEndpoint[]>;
  /** 解析单个工具为可调用端点（含实例/凭证选择）。 */
  resolve(toolId: string, tenantId: string): Promise<ToolEndpoint | null>;
  /** 统一调用入口（executeTool 收口于此，落调用日志）。 */
  invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult>;
  /** 查询单个源的健康记录。 */
  getHealth(sourceId: string): Promise<ToolHealthRecord>;
  /** 全量（或按租户）健康探活，更新状态并触发告警。由 scheduler 定时调用。 */
  healthCheckAll(tenantId?: string): Promise<void>;
}
