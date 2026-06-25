import { describe, it, expect, vi } from 'vitest';
import { ClaudeAgentSdkAdapter, type ClaudeAdapterConfig } from './claude-agent-sdk-adapter.js';
import type {
  IWorkerRunner,
  WorkerCallbacks,
  WorkerRunOptions,
} from './infrastructure/docker-worker-runner.js';
import type { InstanceSessionStore } from './infrastructure/instance-session-store.js';
import type { AgentTaskInput } from './agent-runtime-adapter.js';

/** 可控的 fake runner:捕获最后一次调用的 opts/cbs,让测试主动触发事件 + 控制 resolve */
class FakeRunner implements IWorkerRunner {
  lastOpts: WorkerRunOptions | null = null;
  lastCbs: WorkerCallbacks | null = null;
  lastAbort: AbortController | null = null;
  private resolveFn: (() => void) | null = null;
  runPromise: Promise<void>;
  imageAvailable = true;

  constructor() {
    this.runPromise = new Promise<void>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  /** 测试触发:模拟 worker 进程正常退出 0 */
  resolveRun(): void {
    this.resolveFn?.();
  }

  async run(
    opts: WorkerRunOptions,
    cbs: WorkerCallbacks,
    abortCtl: AbortController
  ): Promise<void> {
    this.lastOpts = opts;
    this.lastCbs = cbs;
    this.lastAbort = abortCtl;
    return this.runPromise;
  }
  async checkImageAvailable(image: string): Promise<boolean> {
    return this.imageAvailable && image === 'claude-worker:latest';
  }
}

/** 可控的 fake session store */
class FakeSessionStore implements InstanceSessionStore {
  store = new Map<string, string>();
  getSessionId = vi.fn(async (id: string) => this.store.get(id));
  setSessionId = vi.fn(async (id: string, sid: string) => {
    this.store.set(id, sid);
  });
  deleteSessionId = vi.fn(async (id: string) => {
    this.store.delete(id);
  });
}

function makeConfig(overrides: Partial<ClaudeAdapterConfig> = {}): ClaudeAdapterConfig {
  return {
    apiKey: 'sk-ant-test',
    anthropicBaseUrl: '',
    workerImage: 'claude-worker:latest',
    workerTimeoutMs: 30_000,
    workspaceRoot: '/tmp/hmr-tasks',
    defaultModel: 'claude-sonnet-4-6',
    defaultMaxTurns: 10,
    defaultBudgetUsd: 3,
    ...overrides,
  };
}

function makeTask(overrides: Partial<AgentTaskInput> = {}): AgentTaskInput {
  return {
    id: 'src-task-1',
    tenantId: 'tn_demo',
    name: 'do-work',
    description: 'test task',
    priority: 'normal',
    input: { prompt: 'say hi', instanceId: 'inst-1' },
    ...overrides,
  };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ClaudeAgentSdkAdapter - 静态属性', () => {
  it('framework 标识为 claude-agent-sdk', () => {
    const adapter = new ClaudeAgentSdkAdapter(
      new FakeRunner(),
      new FakeSessionStore(),
      makeConfig()
    );
    expect(adapter.framework).toBe('claude-agent-sdk');
    expect(adapter.version).toBe('1.0.0');
  });
});

describe('ClaudeAgentSdkAdapter - submitTask', () => {
  it('接受任务并返回唯一 taskId', async () => {
    const adapter = new ClaudeAgentSdkAdapter(
      new FakeRunner(),
      new FakeSessionStore(),
      makeConfig()
    );
    const res = await adapter.submitTask(makeTask());
    expect(res.accepted).toBe(true);
    expect(res.taskId).toMatch(/^cld_/);
  });

  it('runner 被调用一次,prompt 来自 task.input.prompt', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    await adapter.submitTask(makeTask({ input: { prompt: 'analyze code', instanceId: 'inst-x' } }));
    await tick();

    expect(runner.lastOpts).not.toBeNull();
    expect(runner.lastOpts!.prompt).toBe('analyze code');
    expect(runner.lastOpts!.instanceId).toBe('inst-x');
    expect(runner.lastOpts!.tenantId).toBe('tn_demo');
  });

  it('提交后状态为 dispatched', async () => {
    const adapter = new ClaudeAgentSdkAdapter(
      new FakeRunner(),
      new FakeSessionStore(),
      makeConfig()
    );
    const { taskId } = await adapter.submitTask(makeTask());
    const status = await adapter.getTaskStatus(taskId);
    expect(status.state).toBe('dispatched');
    expect(status.progress).toBe(0);
  });
});

describe('ClaudeAgentSdkAdapter - session resume', () => {
  it('instanceId 已有 sessionId 时传入 runner', async () => {
    const session = new FakeSessionStore();
    session.store.set('inst-1', 'sess-existing-001');

    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, session, makeConfig());
    await adapter.submitTask(makeTask());
    await tick();

    expect(runner.lastOpts!.sessionId).toBe('sess-existing-001');
  });

  it('instanceId 无 sessionId 时 runner.sessionId 为 undefined', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    await adapter.submitTask(makeTask());
    await tick();

    expect(runner.lastOpts!.sessionId).toBeUndefined();
  });

  it('worker 回传 session_id 时持久化到 store', async () => {
    const session = new FakeSessionStore();
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, session, makeConfig());
    await adapter.submitTask(makeTask());
    await tick();

    runner.lastCbs!.onSessionId!('sess-new-999');
    await tick();

    expect(session.setSessionId).toHaveBeenCalledWith('inst-1', 'sess-new-999');
  });
});

describe('ClaudeAgentSdkAdapter - 生命周期回调', () => {
  it('progress 事件更新 state.progress', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const { taskId } = await adapter.submitTask(makeTask());
    await tick();

    runner.lastCbs!.onProgress!({ progress: 42 });
    await tick();

    const status = await adapter.getTaskStatus(taskId);
    expect(status.progress).toBe(42);
  });

  it('result 事件暂存 output,runner.run resolve 后 mark completed', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const calls: AgentTaskResult[] = [];
    adapter.onTaskComplete((r) => calls.push(r));
    const { taskId } = await adapter.submitTask(makeTask());
    await tick();

    // 1. result 事件先到,output 暂存但 state 仍 dispatched
    runner.lastCbs!.onResult!({ result: 'done', stopReason: 'end_turn' });
    await tick();

    let status = await adapter.getTaskStatus(taskId);
    expect(status.output?.summary).toBe('done');
    expect(status.state).not.toBe('completed'); // 尚未 completed
    expect(calls).toHaveLength(0);

    // 2. worker 进程正常退出,mark completed
    runner.resolveRun();
    await tick();

    status = await adapter.getTaskStatus(taskId);
    expect(status.state).toBe('completed');
    expect(status.progress).toBe(100);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.success).toBe(true);
    expect(calls[0]!.output.summary).toBe('done');
    expect(calls[0]!.taskId).toBe(taskId);
  });

  it('result 事件携带 usage 时,onTaskComplete 输出 tokenUsage', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const calls: AgentTaskResult[] = [];
    adapter.onTaskComplete((r) => calls.push(r));
    await adapter.submitTask(makeTask());
    await tick();

    runner.lastCbs!.onResult!({
      result: 'done',
      stopReason: 'end_turn',
      usage: { inputTokens: 1200, outputTokens: 300, model: 'claude-sonnet-4-6' },
    });
    await tick();
    runner.resolveRun();
    await tick();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.tokenUsage).toEqual({
      prompt: 1200,
      completion: 300,
      total: 1500,
      model: 'claude-sonnet-4-6',
    });
  });

  it('result 后再 onError → state 为 failed(错误优先于 result)', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const calls: AgentTaskResult[] = [];
    adapter.onTaskComplete((r) => calls.push(r));
    const { taskId } = await adapter.submitTask(makeTask());
    await tick();

    // worker 先 emit result(可能是"Invalid API key"这种伪 result)
    runner.lastCbs!.onResult!({ result: 'Invalid API key', stopReason: 'unknown' });
    await tick();

    // 然后进程 exit 1 触发 onError
    runner.lastCbs!.onError!(new Error('Claude Code process exited with code 1'));
    await tick();

    // 即使后续 runner.run resolve(此处不调用 resolveRun,因 onError 已 mark final),
    // state 已是 failed
    const status = await adapter.getTaskStatus(taskId);
    expect(status.state).toBe('failed');
    expect(status.error).toContain('exited with code 1');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.success).toBe(false);
  });

  it('error 事件将 state 置 failed 并触发 onTaskComplete(failed)', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const calls: AgentTaskResult[] = [];
    adapter.onTaskComplete((r) => calls.push(r));
    const { taskId } = await adapter.submitTask(makeTask());
    await tick();

    runner.lastCbs!.onError!(new Error('API rate limited'));
    await tick();

    const status = await adapter.getTaskStatus(taskId);
    expect(status.state).toBe('failed');
    expect(status.error).toContain('API rate limited');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.success).toBe(false);
  });

  it('onTaskComplete 返回 unsubscribe 函数', async () => {
    const adapter = new ClaudeAgentSdkAdapter(
      new FakeRunner(),
      new FakeSessionStore(),
      makeConfig()
    );
    const cb = vi.fn();
    const unsub = adapter.onTaskComplete(cb);
    expect(typeof unsub).toBe('function');
    unsub();
    // 触发事件验证不再调用
    // (通过 private cbs 长度难断言,这里仅验证 unsub 不抛错)
  });
});

describe('ClaudeAgentSdkAdapter - cancelTask', () => {
  it('存在的运行中任务被取消', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const { taskId } = await adapter.submitTask(makeTask());
    await tick();

    const res = await adapter.cancelTask(taskId);
    expect(res.cancelled).toBe(true);
    expect(runner.lastAbort!.signal.aborted).toBe(true);

    const status = await adapter.getTaskStatus(taskId);
    expect(status.state).toBe('cancelled');
  });

  it('不存在的 taskId 返回 cancelled:false', async () => {
    const adapter = new ClaudeAgentSdkAdapter(
      new FakeRunner(),
      new FakeSessionStore(),
      makeConfig()
    );
    const res = await adapter.cancelTask('not-exist');
    expect(res.cancelled).toBe(false);
  });

  it('已完成的任务不可取消', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const { taskId } = await adapter.submitTask(makeTask());
    await tick();
    runner.lastCbs!.onResult!({ result: 'done', stopReason: 'end_turn' });
    await tick();
    runner.resolveRun();
    await tick();

    const res = await adapter.cancelTask(taskId);
    expect(res.cancelled).toBe(false);
  });
});

describe('ClaudeAgentSdkAdapter - capabilities & health', () => {
  it('listCapabilities 返回核心能力列表', async () => {
    const adapter = new ClaudeAgentSdkAdapter(
      new FakeRunner(),
      new FakeSessionStore(),
      makeConfig()
    );
    const caps = await adapter.listCapabilities();
    const ids = caps.map((c) => c.id);
    expect(ids).toContain('text-generation');
    expect(ids).toContain('code-execution');
    expect(ids).toContain('information-retrieval');
  });

  it('镜像可用时 healthCheck 返回 healthy', async () => {
    const adapter = new ClaudeAgentSdkAdapter(
      new FakeRunner(),
      new FakeSessionStore(),
      makeConfig()
    );
    const h = await adapter.healthCheck();
    expect(h.healthy).toBe(true);
  });

  it('镜像不可用时 healthCheck 返回 unhealthy', async () => {
    const runner = new FakeRunner();
    runner.imageAvailable = false;
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const h = await adapter.healthCheck();
    expect(h.healthy).toBe(false);
  });
});

describe('ClaudeAgentSdkAdapter - 预算二次熔断', () => {
  it('usage 在预算内时正常 completed', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const calls: AgentTaskResult[] = [];
    adapter.onTaskComplete((r) => calls.push(r));
    // 默认 budget 3 USD,允许 1.2 × 3 = 3.6 USD
    // sonnet: 100k input × $3/M + 50k output × $15/M = $1.05,远低于阈值
    await adapter.submitTask(
      makeTask({
        input: {
          prompt: 'small task',
          instanceId: 'inst-1',
          maxBudgetUsd: 3,
        },
      })
    );
    await tick();

    runner.lastCbs!.onResult!({
      result: 'done',
      stopReason: 'end_turn',
      usage: { inputTokens: 100_000, outputTokens: 50_000, model: 'claude-sonnet-4-6' },
    });
    await tick();
    runner.resolveRun();
    await tick();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.success).toBe(true);
    expect(calls[0]!.tokenUsage?.total).toBe(150_000);
  });

  it('usage 超过 budget × 1.2 时触发熔断 markFailed + abort', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const calls: AgentTaskResult[] = [];
    adapter.onTaskComplete((r) => calls.push(r));
    // budget 1 USD,允许 1.2 USD
    // sonnet: 1M input × $3/M = $3 > 1.2,触发熔断
    await adapter.submitTask(
      makeTask({
        input: {
          prompt: 'expensive task',
          instanceId: 'inst-2',
          maxBudgetUsd: 1,
        },
      })
    );
    await tick();

    runner.lastCbs!.onResult!({
      result: 'some output',
      stopReason: 'end_turn',
      usage: { inputTokens: 1_000_000, outputTokens: 0, model: 'claude-sonnet-4-6' },
    });
    await tick();

    expect(runner.lastAbort!.signal.aborted).toBe(true);
    const status = await adapter.getTaskStatus(runner.lastOpts!.taskId);
    expect(status.state).toBe('failed');
    expect(status.error).toMatch(/budget cap exceeded/i);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.success).toBe(false);
    // 即使熔断,usage 仍上报(供 tokenUsageService 入账)
    expect(calls[0]!.tokenUsage?.prompt).toBe(1_000_000);
  });

  it('budgetUsd = 0 不限制预算(永不熔断)', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const calls: AgentTaskResult[] = [];
    adapter.onTaskComplete((r) => calls.push(r));
    await adapter.submitTask(
      makeTask({
        input: {
          prompt: 'unlimited',
          instanceId: 'inst-3',
          maxBudgetUsd: 0,
        },
      })
    );
    await tick();

    // 即使 100M token 也不熔断
    runner.lastCbs!.onResult!({
      result: 'huge result',
      stopReason: 'end_turn',
      usage: { inputTokens: 100_000_000, outputTokens: 100_000_000, model: 'claude-opus-4-6' },
    });
    await tick();
    runner.resolveRun();
    await tick();

    expect(runner.lastAbort!.signal.aborted).toBe(false);
    expect(calls[0]!.success).toBe(true);
  });

  it('opus 任务按 opus 单价估算(更早触发熔断)', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    const calls: AgentTaskResult[] = [];
    adapter.onTaskComplete((r) => calls.push(r));
    // budget 2 USD,允许 2.4 USD
    // opus: 100k input × $15/M + 10k output × $75/M = $1.5 + $0.75 = $2.25(未超)
    // 提升到 200k input + 20k output = $3 + $1.5 = $4.5(超 2.4)
    await adapter.submitTask(
      makeTask({
        input: {
          prompt: 'opus task',
          instanceId: 'inst-4',
          maxBudgetUsd: 2,
          model: 'claude-opus-4-6',
        },
      })
    );
    await tick();

    runner.lastCbs!.onResult!({
      result: 'opus output',
      stopReason: 'end_turn',
      usage: { inputTokens: 200_000, outputTokens: 20_000, model: 'claude-opus-4-6' },
    });
    await tick();

    expect(runner.lastAbort!.signal.aborted).toBe(true);
    expect(calls[0]!.success).toBe(false);
  });
});

describe('ClaudeAgentSdkAdapter - T18b-C restrictToReadonlyTools 止血开关', () => {
  it('开关关闭(默认):Bash/Write/Edit 保留(兼容现有无绑定工具 Agent 行为)', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(runner, new FakeSessionStore(), makeConfig());
    await adapter.submitTask(makeTask()); // 未传 allowedTools → 走默认全工具
    await tick();

    expect(runner.lastOpts!.allowedTools).toEqual(
      expect.arrayContaining([
        'Bash',
        'Write',
        'Edit',
        'Read',
        'Glob',
        'Grep',
        'WebSearch',
        'WebFetch',
      ])
    );
  });

  it('开关开启:默认工具集过滤掉 Bash/Write/Edit,仅留只读工具', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(
      runner,
      new FakeSessionStore(),
      makeConfig({ restrictToReadonlyTools: true })
    );
    await adapter.submitTask(makeTask()); // 未传 allowedTools → 走默认,再过滤副作用
    await tick();

    expect(runner.lastOpts!.allowedTools).not.toContain('Bash');
    expect(runner.lastOpts!.allowedTools).not.toContain('Write');
    expect(runner.lastOpts!.allowedTools).not.toContain('Edit');
    expect(runner.lastOpts!.allowedTools).toEqual(
      expect.arrayContaining(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'])
    );
  });

  it('开关开启:显式传入含 Bash 的 allowedTools 也被过滤', async () => {
    const runner = new FakeRunner();
    const adapter = new ClaudeAgentSdkAdapter(
      runner,
      new FakeSessionStore(),
      makeConfig({ restrictToReadonlyTools: true })
    );
    await adapter.submitTask(
      makeTask({ input: { prompt: 'p', instanceId: 'i', allowedTools: ['Bash', 'Read', 'Write'] } })
    );
    await tick();

    expect(runner.lastOpts!.allowedTools).toEqual(['Read']);
  });
});

// 引入类型供 onTaskComplete 测试用
import type { AgentTaskResult } from './agent-runtime-adapter.js';
