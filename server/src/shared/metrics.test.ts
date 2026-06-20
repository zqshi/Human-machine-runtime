import { describe, it, expect } from 'vitest';
import {
  registry,
  httpRequestTotal,
  httpRequestDurationSeconds,
  llmCallsTotal,
  decisionsCreatedTotal,
  channelMessagesInboundTotal,
} from './metrics.js';

/**
 * Prometheus 指标验证。prom-client v15 的 metrics()/getMetricsAsJSON() 为 async，
 * 用例 await。每用例用唯一标签规避跨用例单例累积。
 */

async function valueOf(metricName: string, labels: Record<string, string>): Promise<number> {
  const json = (await registry.getMetricsAsJSON()) as Array<{
    name: string;
    values: Array<{ labels: Record<string, string>; value: number }>;
  }>;
  const metric = json.find((m) => m.name === metricName);
  if (!metric) return -1;
  const hit = metric.values.find((v) =>
    Object.entries(labels).every(([k, val]) => v.labels[k] === val)
  );
  return hit?.value ?? -1;
}

describe('metrics registry', () => {
  it('registry.metrics() 文本暴露所有核心自定义指标', async () => {
    const out = await registry.metrics();
    expect(typeof out).toBe('string');
    expect(out).toContain('http_requests_total');
    expect(out).toContain('http_request_duration_seconds');
    expect(out).toContain('llm_calls_total');
    expect(out).toContain('decisions_created_total');
    expect(out).toContain('channel_messages_inbound_total');
  });

  it('Counter inc 累加正确', async () => {
    const tag = `crit-${Date.now()}`;
    decisionsCreatedTotal.labels(tag).inc();
    decisionsCreatedTotal.labels(tag).inc(2);
    expect(await valueOf('decisions_created_total', { urgency: tag })).toBe(3);
  });

  it('llmCallsTotal 按 model/status 打标签', async () => {
    const tag = `m-${Date.now()}`;
    llmCallsTotal.labels(tag, 'success').inc(1);
    llmCallsTotal.labels(tag, 'error').inc(2);
    expect(await valueOf('llm_calls_total', { model: tag, status: 'success' })).toBe(1);
    expect(await valueOf('llm_calls_total', { model: tag, status: 'error' })).toBe(2);
  });

  it('httpRequestTotal 按 method/route/status 打标签', async () => {
    const tag = `/r-${Date.now()}`;
    httpRequestTotal.labels('GET', tag, '200').inc();
    expect(await valueOf('http_requests_total', { method: 'GET', route: tag, status: '200' })).toBe(
      1
    );
  });

  it('Histogram observe 不抛错', () => {
    expect(() => {
      httpRequestDurationSeconds.labels('GET', '/x', '200').observe(0.12);
      channelMessagesInboundTotal.labels('matrix', 'alert').inc();
    }).not.toThrow();
  });
});
