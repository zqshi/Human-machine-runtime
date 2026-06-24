import { describe, it, expect, vi } from 'vitest';
import { AgentHarness } from './harness.js';
import type { AdapterRegistry } from '../sandbox/adapter-registry.js';
import type { IAssemblyProvider } from '../domain/assembly-provider.js';
import type { AgentTaskInput } from '../sandbox/agent-runtime-adapter.js';

/** 最小 SessionStore stub:dispatchTask 路径不触发 executor,taskArtifactStore 给空 stub 即可 */
function makeSessionStub() {
  return { taskArtifactStore: { set: vi.fn(), get: vi.fn() } };
}

/** mock AdapterRegistry:捕获 dispatchTask 收到的 task(验证 assembly 注入) */
function makeSandboxStub(captured: { task: AgentTaskInput | null }) {
  return {
    dispatchTask: vi.fn(async (task: AgentTaskInput) => {
      captured.task = task;
      return { taskId: task.id, framework: 'claude-agent-sdk' as const };
    }),
    get: vi.fn(),
  } as unknown as AdapterRegistry;
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

describe('AgentHarness - assembly 注入(v1.4)', () => {
  it('assemblyProvider 注入 allowedTools + skillsContext 到 task.input', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    const asm: IAssemblyProvider = {
      assemble: vi.fn().mockResolvedValue({
        allowedTools: ['Bash', 'Write'],
        skillsContext: '## 报销技能\n步骤1',
        sources: {
          tools: { bound: 2, resolved: 2, skipped: 0 },
          skills: { bound: 1, resolved: 1, skipped: 0 },
        },
        skipped: false,
        degraded: false,
      }),
    };
    harness.setAssemblyProvider(asm);

    await harness.dispatchTask(makeTask());

    expect(captured.task!.input.allowedTools).toEqual(['Bash', 'Write']);
    expect(captured.task!.input.skillsContext).toBe('## 报销技能\n步骤1');
  });

  it('调用方已显式传 allowedTools → assembly 不覆盖', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setAssemblyProvider({
      assemble: vi.fn().mockResolvedValue({
        allowedTools: ['Bash'],
        sources: {
          tools: { bound: 1, resolved: 1, skipped: 0 },
          skills: { bound: 0, resolved: 0, skipped: 0 },
        },
        skipped: false,
        degraded: false,
      }),
    });

    await harness.dispatchTask(makeTask({ input: { allowedTools: ['Read'] } }));

    expect(captured.task!.input.allowedTools).toEqual(['Read']); // 调用方优先
  });

  it('assembly skipped → 不改 task.input(走默认)', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setAssemblyProvider({
      assemble: vi.fn().mockResolvedValue({
        sources: {
          tools: { bound: 0, resolved: 0, skipped: 0 },
          skills: { bound: 0, resolved: 0, skipped: 0 },
        },
        skipped: true,
        degraded: false,
      }),
    });

    const task = makeTask();
    await harness.dispatchTask(task);

    // assembly skipped → 未注入 allowedTools/skillsContext(核心意图)。
    // 注:v1.6 dispatchTask 会写回 traceId 到 input(协议预留),故 input 含 traceId,
    // 此处只断言 assembly 维度未改,不断言整个 input 等于原始。
    expect(captured.task!.input.allowedTools).toBeUndefined();
    expect(captured.task!.input.skillsContext).toBeUndefined();
  });

  it('assembly degraded → publish 事件但 allowedTools 不覆盖(不静默放开全工具)', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setAssemblyProvider({
      assemble: vi.fn().mockResolvedValue({
        allowedTools: undefined, // 全失效
        sources: {
          tools: { bound: 1, resolved: 0, skipped: 1 },
          skills: { bound: 0, resolved: 0, skipped: 0 },
        },
        skipped: false,
        degraded: true,
      }),
    });

    await harness.dispatchTask(makeTask());

    expect(captured.task!.input.allowedTools).toBeUndefined();
  });

  it('assembly 抛错 → 不阻断主链路(task 仍 dispatch)', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    harness.setAssemblyProvider({
      assemble: vi.fn().mockRejectedValue(new Error('assembly down')),
    });

    await harness.dispatchTask(makeTask());

    // task 仍被 dispatch(sandbox 收到)
    expect(captured.task).not.toBeNull();
    expect(captured.task!.id).toBe('task-1');
  });

  it('无 assemblyProvider → dispatchTask 正常(不报错)', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    // 未 setAssemblyProvider

    await expect(harness.dispatchTask(makeTask())).resolves.toEqual({
      taskId: 'task-1',
      framework: 'claude-agent-sdk',
    });
  });
});
