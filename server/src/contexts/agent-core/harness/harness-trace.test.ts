import { describe, it, expect, vi } from 'vitest';
import { AgentHarness } from './harness.js';
import type { AdapterRegistry } from '../sandbox/adapter-registry.js';
import type { ITraceRecorder, SpanWriteData } from '../domain/trace-recorder.js';
import type { AgentTaskInput } from '../sandbox/agent-runtime-adapter.js';

function makeSessionStub() {
  return { taskArtifactStore: { set: vi.fn(), get: vi.fn() } };
}

function makeSandboxStub(captured: { task: AgentTaskInput | null }) {
  return {
    dispatchTask: vi.fn(async (task: AgentTaskInput) => {
      captured.task = task;
      return { taskId: task.id, framework: 'claude-agent-sdk' as const };
    }),
    get: vi.fn(),
  } as unknown as AdapterRegistry;
}

function makeRecorder(calls: {
  roots: Array<{ traceId: string; rootOperation?: string }>;
  spans: SpanWriteData[];
  updates: Array<{ traceId: string; patch: unknown }>;
}): ITraceRecorder {
  return {
    insertDistributedTrace: vi.fn(async (data) => {
      calls.roots.push({ traceId: data.traceId, rootOperation: data.rootOperation });
    }),
    insertSpan: vi.fn(async (data) => {
      calls.spans.push(data);
    }),
    updateDistributedTrace: vi.fn(async (traceId, patch) => {
      calls.updates.push({ traceId, patch });
    }),
  };
}

function makeTask(overrides: Partial<AgentTaskInput> = {}): AgentTaskInput {
  return {
    id: 'task-1',
    tenantId: 'tn_demo',
    name: 'do-work',
    description: 'desc',
    priority: 'normal',
    input: { instanceId: 'inst-1', prompt: 'hi' },
    ...overrides,
  };
}

describe('AgentHarness - trace 埋点(v1.6)', () => {
  it('dispatchTask 写根 trace + 3 span(rag/assembly/sandbox)+ 收尾', async () => {
    const captured = { task: null };
    const calls = { roots: [] as Array<{ traceId: string; rootOperation?: string }>, spans: [] as SpanWriteData[], updates: [] as Array<{ traceId: string; patch: unknown }> };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setTraceRecorder(makeRecorder(calls));

    await harness.dispatchTask(makeTask());

    // 根 trace 1 个
    expect(calls.roots).toHaveLength(1);
    expect(calls.roots[0].rootOperation).toBe('agent.task');

    // sandbox span(client kind,扁平挂根)
    const sandboxSpan = calls.spans.find((s) => s.operationName === 'sandbox.dispatch');
    expect(sandboxSpan).toBeDefined();
    expect(sandboxSpan!.spanKind).toBe('client');
    expect(sandboxSpan!.parentSpanId).toBeUndefined(); // 扁平挂根
    expect(sandboxSpan!.distTraceId).toBe(calls.roots[0].traceId);

    // 收尾 1 个(status=completed)
    expect(calls.updates).toHaveLength(1);
    expect((calls.updates[0].patch as { status: string }).status).toBe('completed');
  });

  it('所有 span 的 distTraceId 指向同一根 traceId', async () => {
    const captured = { task: null };
    const calls = { roots: [] as Array<{ traceId: string }>, spans: [] as SpanWriteData[], updates: [] as Array<{ traceId: string }> };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setTraceRecorder(makeRecorder(calls));

    await harness.dispatchTask(makeTask());

    const rootTraceId = calls.roots[0].traceId;
    expect(calls.spans.length).toBeGreaterThan(0);
    for (const s of calls.spans) {
      expect(s.distTraceId).toBe(rootTraceId);
    }
  });

  it('生成的 traceId 写回 task.input(让 adapter/worker 透传)', async () => {
    const captured = { task: null };
    const calls = { roots: [] as Array<{ traceId: string }>, spans: [] as SpanWriteData[], updates: [] as Array<{ traceId: string }> };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setTraceRecorder(makeRecorder(calls));

    await harness.dispatchTask(makeTask());

    expect(captured.task!.input.traceId).toBe(calls.roots[0].traceId);
  });

  it('调用方显式传 traceId → 复用不新建', async () => {
    const captured = { task: null };
    const calls = { roots: [] as Array<{ traceId: string }>, spans: [] as SpanWriteData[], updates: [] as Array<{ traceId: string }> };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setTraceRecorder(makeRecorder(calls));

    const existingTraceId = 'trc_existing_123';
    await harness.dispatchTask(makeTask({ input: { traceId: existingTraceId } }));

    expect(calls.roots[0].traceId).toBe(existingTraceId);
  });

  it('recorder=null → dispatchTask 正常(trace 静默跳过)', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    // 未 setTraceRecorder

    await expect(harness.dispatchTask(makeTask())).resolves.toEqual({
      taskId: 'task-1',
      framework: 'claude-agent-sdk',
    });
  });

  it('recorder.insertDistributedTrace 抛错 → 不阻断主链路', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setTraceRecorder({
      insertDistributedTrace: vi.fn().mockRejectedValue(new Error('db down')),
      insertSpan: vi.fn().mockResolvedValue(undefined),
      updateDistributedTrace: vi.fn().mockResolvedValue(undefined),
    });

    const r = await harness.dispatchTask(makeTask());
    expect(r.taskId).toBe('task-1'); // 主链路不受影响
  });

  it('recorder.insertSpan 抛错 → 不阻断主链路(span 旁路容错)', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setTraceRecorder({
      insertDistributedTrace: vi.fn().mockResolvedValue(undefined),
      insertSpan: vi.fn().mockRejectedValue(new Error('span write fail')),
      updateDistributedTrace: vi.fn().mockResolvedValue(undefined),
    });

    const r = await harness.dispatchTask(makeTask());
    expect(r.taskId).toBe('task-1');
  });
});
