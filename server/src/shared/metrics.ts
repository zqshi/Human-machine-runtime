/**
 * Prometheus 指标注册中心与核心指标定义。
 *
 * 使用 prom-client 全局 register（最稳，避免自定义 Registry 的注册坑）。
 * 指标命名遵循 Prometheus 约定（_total / _seconds）。collectDefaultMetrics
 * 采集 Node 运行时（heap/gc/event_loop），无需手动埋点。
 */

import { Counter, Histogram, collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics();

export { register as registry };

// ── HTTP ────────────────────────────────────────────────────────────

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'HTTP 请求总数',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP 请求处理延迟（秒）',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10],
});

// ── LLM ────────────────────────────────────────────────────────────

export const llmCallsTotal = new Counter({
  name: 'llm_calls_total',
  help: 'LLM 调用总数',
  labelNames: ['model', 'status'],
});

export const llmCallDurationSeconds = new Histogram({
  name: 'llm_call_duration_seconds',
  help: 'LLM 调用延迟（秒）',
  labelNames: ['model', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
});

// ── 业务：决策 / 渠道 ──────────────────────────────────────────────

export const decisionsCreatedTotal = new Counter({
  name: 'decisions_created_total',
  help: '决策产出总数（由真实消息投影驱动）',
  labelNames: ['urgency'],
});

export const channelMessagesInboundTotal = new Counter({
  name: 'channel_messages_inbound_total',
  help: '渠道入站消息总数',
  labelNames: ['channel_type', 'intent'],
});
