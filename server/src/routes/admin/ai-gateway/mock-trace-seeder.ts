import type { AiGatewayRepository } from '../../../db/repositories/ai-gateway-repository.js';

/**
 * Mock 分布式 trace 播种数据 —— 仅用于开发/演示。
 *
 * 构造 3 条典型场景的分布式 trace 及其 span 链：
 *   1. 用户对话（多轮 LLM + 工具调用）
 *   2. 风险拦截
 *   3. 工具重试
 *
 * 生产环境由路由层以 NODE_ENV 拦截（返回 403），不会调用本函数，
 * 以避免 mock 数据污染线上 trace。
 */
export async function seedMockDistributedTraces(
  repo: AiGatewayRepository
): Promise<{ seeded: string[]; count: number }> {
  const now = new Date();
  const traces: string[] = [];

  // Trace 1: 用户对话 — 多轮 LLM + 工具调用
  const t1Id = 'dt-user-chat-001';
  await repo.insertDistributedTrace({
    traceId: t1Id,
    rootOperation: 'user.chat',
    userId: 'u-zhangsan',
    instanceId: 'agent-cs-bot',
    sessionId: 'sess-20260608-001',
    tags: { source: 'openclaw', channel: 'web' },
  });
  traces.push(t1Id);

  // Span: gateway.receive
  await repo.insertTrace({
    traceId: 'span-gw-recv-001',
    distTraceId: t1Id,
    parentSpanId: undefined,
    operationName: 'gateway.receive',
    spanKind: 'server',
    sessionId: 'sess-20260608-001',
    requestId: 'req-gw-001',
    userId: 'u-zhangsan',
    instanceId: 'agent-cs-bot',
    requestedModel: 'auto',
    status: 'success',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 12,
    startTime: new Date(now.getTime() - 5200),
    createdAt: new Date(now.getTime() - 5200),
    completedAt: new Date(now.getTime() - 5188),
  });

  // Span: risk.check
  await repo.insertTrace({
    traceId: 'span-risk-001',
    distTraceId: t1Id,
    parentSpanId: 'span-gw-recv-001',
    operationName: 'risk.check',
    spanKind: 'internal',
    sessionId: 'sess-20260608-001',
    requestId: 'req-risk-001',
    userId: 'u-zhangsan',
    requestedModel: 'auto',
    status: 'success',
    promptTokens: 50,
    completionTokens: 0,
    latencyMs: 35,
    startTime: new Date(now.getTime() - 5180),
    createdAt: new Date(now.getTime() - 5180),
    completedAt: new Date(now.getTime() - 5145),
  });

  // Span: llm.call (第1轮)
  await repo.insertTrace({
    traceId: 'span-llm1-001',
    distTraceId: t1Id,
    parentSpanId: 'span-gw-recv-001',
    operationName: 'llm.call',
    spanKind: 'client',
    sessionId: 'sess-20260608-001',
    requestId: 'req-llm1-001',
    userId: 'u-zhangsan',
    instanceId: 'agent-cs-bot',
    requestedModel: 'claude-sonnet-4-6',
    actualModel: 'claude-sonnet-4-6',
    providerType: 'anthropic',
    status: 'success',
    promptTokens: 1200,
    completionTokens: 300,
    latencyMs: 2100,
    estimatedCost: 0.045,
    startTime: new Date(now.getTime() - 5100),
    createdAt: new Date(now.getTime() - 5100),
    completedAt: new Date(now.getTime() - 3000),
  });

  // Span: tool.exec (search)
  await repo.insertTrace({
    traceId: 'span-tool1-001',
    distTraceId: t1Id,
    parentSpanId: 'span-gw-recv-001',
    operationName: 'tool.exec',
    spanKind: 'client',
    sessionId: 'sess-20260608-001',
    requestId: 'req-tool-001',
    userId: 'u-zhangsan',
    instanceId: 'agent-cs-bot',
    requestedModel: 'auto',
    status: 'success',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 450,
    startTime: new Date(now.getTime() - 2950),
    createdAt: new Date(now.getTime() - 2950),
    completedAt: new Date(now.getTime() - 2500),
    metadata: { tool_name: 'knowledge_search', query: '退款政策' },
  });

  // Span: llm.call (第2轮 — 带工具结果)
  await repo.insertTrace({
    traceId: 'span-llm2-001',
    distTraceId: t1Id,
    parentSpanId: 'span-gw-recv-001',
    operationName: 'llm.call',
    spanKind: 'client',
    sessionId: 'sess-20260608-001',
    requestId: 'req-llm2-001',
    userId: 'u-zhangsan',
    instanceId: 'agent-cs-bot',
    requestedModel: 'claude-sonnet-4-6',
    actualModel: 'claude-sonnet-4-6',
    providerType: 'anthropic',
    status: 'success',
    promptTokens: 1800,
    completionTokens: 500,
    latencyMs: 2800,
    estimatedCost: 0.062,
    startTime: new Date(now.getTime() - 2450),
    createdAt: new Date(now.getTime() - 2450),
    completedAt: new Date(now.getTime() - 350),
  });

  // Span: gateway.respond
  await repo.insertTrace({
    traceId: 'span-gw-resp-001',
    distTraceId: t1Id,
    parentSpanId: undefined,
    operationName: 'gateway.respond',
    spanKind: 'server',
    sessionId: 'sess-20260608-001',
    requestId: 'req-gw-resp-001',
    userId: 'u-zhangsan',
    instanceId: 'agent-cs-bot',
    requestedModel: 'auto',
    status: 'success',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 8,
    startTime: new Date(now.getTime() - 340),
    createdAt: new Date(now.getTime() - 340),
    completedAt: new Date(now.getTime() - 332),
  });

  await repo.updateDistributedTrace(t1Id, {
    spanCount: 6,
    status: 'success',
    totalTokens: 3850,
    totalCost: 0.107,
    totalDurationMs: 5200,
    completedAt: new Date(now.getTime() - 332),
  });

  // Trace 2: 风险拦截场景
  const t2Id = 'dt-risk-block-002';
  await repo.insertDistributedTrace({
    traceId: t2Id,
    rootOperation: 'user.chat',
    userId: 'u-lisi',
    instanceId: 'agent-finance',
    sessionId: 'sess-20260608-002',
    tags: { source: 'openclaw', channel: 'api' },
  });
  traces.push(t2Id);

  await repo.insertTrace({
    traceId: 'span-gw-recv-002',
    distTraceId: t2Id,
    parentSpanId: undefined,
    operationName: 'gateway.receive',
    spanKind: 'server',
    sessionId: 'sess-20260608-002',
    requestId: 'req-gw-002',
    userId: 'u-lisi',
    instanceId: 'agent-finance',
    requestedModel: 'auto',
    status: 'success',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 10,
    startTime: new Date(now.getTime() - 800),
    createdAt: new Date(now.getTime() - 800),
    completedAt: new Date(now.getTime() - 790),
  });

  await repo.insertTrace({
    traceId: 'span-risk-002',
    distTraceId: t2Id,
    parentSpanId: 'span-gw-recv-002',
    operationName: 'risk.check',
    spanKind: 'internal',
    sessionId: 'sess-20260608-002',
    requestId: 'req-risk-002',
    userId: 'u-lisi',
    requestedModel: 'auto',
    status: 'blocked',
    promptTokens: 80,
    completionTokens: 0,
    latencyMs: 28,
    startTime: new Date(now.getTime() - 785),
    createdAt: new Date(now.getTime() - 785),
    completedAt: new Date(now.getTime() - 757),
  });

  await repo.insertTrace({
    traceId: 'span-llm1-002',
    distTraceId: t2Id,
    parentSpanId: 'span-gw-recv-002',
    operationName: 'llm.call',
    spanKind: 'client',
    sessionId: 'sess-20260608-002',
    requestId: 'req-llm1-002',
    userId: 'u-lisi',
    instanceId: 'agent-finance',
    requestedModel: 'gpt-4o',
    actualModel: 'gpt-4o',
    providerType: 'openai',
    status: 'error',
    promptTokens: 200,
    completionTokens: 0,
    latencyMs: 5000,
    estimatedCost: 0.01,
    startTime: new Date(now.getTime() - 750),
    createdAt: new Date(now.getTime() - 750),
    completedAt: new Date(now.getTime() - 200),
    metadata: { error: 'context_length_exceeded' },
  });

  await repo.updateDistributedTrace(t2Id, {
    spanCount: 3,
    status: 'blocked',
    totalTokens: 280,
    totalCost: 0.01,
    totalDurationMs: 800,
    completedAt: new Date(now.getTime() - 200),
  });

  // Trace 3: 工具重试场景
  const t3Id = 'dt-tool-retry-003';
  await repo.insertDistributedTrace({
    traceId: t3Id,
    rootOperation: 'agent.task',
    userId: 'u-wangwu',
    instanceId: 'agent-data-analyst',
    sessionId: 'sess-20260608-003',
    tags: { source: 'agent-scheduler' },
  });
  traces.push(t3Id);

  await repo.insertTrace({
    traceId: 'span-gw-recv-003',
    distTraceId: t3Id,
    parentSpanId: undefined,
    operationName: 'gateway.receive',
    spanKind: 'server',
    sessionId: 'sess-20260608-003',
    requestId: 'req-gw-003',
    userId: 'u-wangwu',
    instanceId: 'agent-data-analyst',
    requestedModel: 'auto',
    status: 'success',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 8,
    startTime: new Date(now.getTime() - 12000),
    createdAt: new Date(now.getTime() - 12000),
    completedAt: new Date(now.getTime() - 11992),
  });

  await repo.insertTrace({
    traceId: 'span-llm1-003',
    distTraceId: t3Id,
    parentSpanId: 'span-gw-recv-003',
    operationName: 'llm.call',
    spanKind: 'client',
    sessionId: 'sess-20260608-003',
    requestId: 'req-llm1-003',
    userId: 'u-wangwu',
    instanceId: 'agent-data-analyst',
    requestedModel: 'deepseek-chat',
    actualModel: 'deepseek-chat',
    providerType: 'deepseek',
    status: 'success',
    promptTokens: 800,
    completionTokens: 200,
    latencyMs: 1500,
    estimatedCost: 0.003,
    startTime: new Date(now.getTime() - 11900),
    createdAt: new Date(now.getTime() - 11900),
    completedAt: new Date(now.getTime() - 10400),
  });

  await repo.insertTrace({
    traceId: 'span-tool1-003',
    distTraceId: t3Id,
    parentSpanId: 'span-gw-recv-003',
    operationName: 'tool.exec',
    spanKind: 'client',
    sessionId: 'sess-20260608-003',
    requestId: 'req-tool-003a',
    userId: 'u-wangwu',
    instanceId: 'agent-data-analyst',
    requestedModel: 'auto',
    status: 'error',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 3000,
    startTime: new Date(now.getTime() - 10350),
    createdAt: new Date(now.getTime() - 10350),
    completedAt: new Date(now.getTime() - 7350),
    metadata: { tool_name: 'sql_query', error: 'connection_timeout' },
  });

  await repo.insertTrace({
    traceId: 'span-tool1-003r',
    distTraceId: t3Id,
    parentSpanId: 'span-gw-recv-003',
    operationName: 'tool.exec (retry)',
    spanKind: 'client',
    sessionId: 'sess-20260608-003',
    requestId: 'req-tool-003b',
    userId: 'u-wangwu',
    instanceId: 'agent-data-analyst',
    requestedModel: 'auto',
    status: 'success',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 1200,
    startTime: new Date(now.getTime() - 7300),
    createdAt: new Date(now.getTime() - 7300),
    completedAt: new Date(now.getTime() - 6100),
    metadata: { tool_name: 'sql_query', retry: true },
  });

  await repo.insertTrace({
    traceId: 'span-llm2-003',
    distTraceId: t3Id,
    parentSpanId: 'span-gw-recv-003',
    operationName: 'llm.call',
    spanKind: 'client',
    sessionId: 'sess-20260608-003',
    requestId: 'req-llm2-003',
    userId: 'u-wangwu',
    instanceId: 'agent-data-analyst',
    requestedModel: 'deepseek-chat',
    actualModel: 'deepseek-chat',
    providerType: 'deepseek',
    status: 'success',
    promptTokens: 1200,
    completionTokens: 400,
    latencyMs: 2000,
    estimatedCost: 0.005,
    startTime: new Date(now.getTime() - 6050),
    createdAt: new Date(now.getTime() - 6050),
    completedAt: new Date(now.getTime() - 4050),
  });

  await repo.insertTrace({
    traceId: 'span-gw-resp-003',
    distTraceId: t3Id,
    parentSpanId: undefined,
    operationName: 'gateway.respond',
    spanKind: 'server',
    sessionId: 'sess-20260608-003',
    requestId: 'req-gw-resp-003',
    userId: 'u-wangwu',
    instanceId: 'agent-data-analyst',
    requestedModel: 'auto',
    status: 'success',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 5,
    startTime: new Date(now.getTime() - 4040),
    createdAt: new Date(now.getTime() - 4040),
    completedAt: new Date(now.getTime() - 4035),
  });

  await repo.updateDistributedTrace(t3Id, {
    spanCount: 6,
    status: 'success',
    totalTokens: 2600,
    totalCost: 0.008,
    totalDurationMs: 12000,
    completedAt: new Date(now.getTime() - 4035),
  });

  return { seeded: traces, count: traces.length };
}
