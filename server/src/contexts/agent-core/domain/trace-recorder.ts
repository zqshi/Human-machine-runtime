/**
 * trace 记录器 port(v1.6)— agent 执行全链路 trace 串联。
 *
 * 守 §1.3:agent-core domain 不直接依赖 AiGatewayRepository(observability 跨聚合)。
 * bootstrap 用 AiGatewayRepository 适配实现。复刻 D2/v1.4 port 模式。
 *
 * 复用现有 OTel 级 span 模型:distributed_traces(根)+ ai_traces(降级为 span)。
 * 建树靠 distTraceId 聚合 + parentSpanId 串联(getDistributedTraceDetail/buildSpanTree 已就绪)。
 *
 * 设计:扁平挂根——编排链路各步骤 span 的 parentSpanId 均为 undefined,全挂根 trace
 * (harness 三段是串行编排非父子嵌套)。currentSpanId 保留为后续嵌套/worker 接入预留。
 */

/** 根 trace 写入数据 */
export interface DistributedTraceInput {
  traceId: string;
  rootOperation?: string;
  userId?: string;
  instanceId?: string;
  sessionId?: string;
  tags?: Record<string, unknown>;
}

/** span 写入数据(对应 ai_traces 一行) */
export interface SpanWriteData {
  /** span 自身 id(ai_traces.traceId) */
  spanId: string;
  /** 所属根 trace id(ai_traces.distTraceId) */
  distTraceId: string;
  /** 父 span id;undefined = 挂根(扁平挂根范式) */
  parentSpanId?: string;
  operationName: string;
  spanKind: 'server' | 'client' | 'internal';
  startTime: Date;
  latencyMs: number;
  status: string;
  metadata?: Record<string, unknown>;
}

/** 根 trace 收尾更新 */
export interface DistributedTraceUpdate {
  spanCount?: number;
  status?: string;
  totalDurationMs?: number;
  completedAt?: Date;
}

export interface ITraceRecorder {
  insertDistributedTrace(data: DistributedTraceInput): Promise<void>;
  insertSpan(data: SpanWriteData): Promise<void>;
  updateDistributedTrace(traceId: string, patch: DistributedTraceUpdate): Promise<void>;
}

/**
 * trace 上下文(harness dispatchTask 内局部维护,不外泄)。
 * currentSpanId 当前未用(扁平挂根),保留为后续嵌套/worker 接入预留。
 */
export interface TraceContext {
  traceId: string;
  currentSpanId?: string;
}

/** 不记录的 no-op 实现(recorder 未注入时用,dispatchTask 静默跳过 trace) */
export class NullTraceRecorder implements ITraceRecorder {
  async insertDistributedTrace(): Promise<void> {}
  async insertSpan(): Promise<void> {}
  async updateDistributedTrace(): Promise<void> {}
}
