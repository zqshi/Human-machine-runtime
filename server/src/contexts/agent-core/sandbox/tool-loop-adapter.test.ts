import { describe, it, expect, vi } from 'vitest';
import { ToolLoopAdapter } from './tool-loop-adapter.js';
import type { ToolLoopExecutor, ToolLoopResult } from '../domain/tool-loop-executor.js';
import type { AgentTaskInput } from './agent-runtime-adapter.js';

function makeExecutor(result: Partial<ToolLoopResult> = {}): ToolLoopExecutor {
  return {
    run: vi.fn(async () => ({
      conclusion: result.conclusion ?? '任务完成',
      toolCallsLog: result.toolCallsLog ?? [],
      turns: result.turns ?? 1,
    })),
  } as unknown as ToolLoopExecutor & { run: ReturnType<typeof vi.fn> };
}

function makeTask(over: Partial<AgentTaskInput> = {}): AgentTaskInput {
  return {
    id: 'task-1',
    tenantId: 'tn_1',
    name: '查询任务',
    description: '查知识库',
    priority: 'normal' as never,
    input: { prompt: '查一下' },
    ...over,
  };
}

describe('ToolLoopAdapter', () => {
  it('framework=tool-loop, version 非空', () => {
    const adapter = new ToolLoopAdapter(makeExecutor());
    expect(adapter.framework).toBe('tool-loop');
    expect(adapter.version).toBeTruthy();
  });

  it('submitTask 异步触发 executor.run,立即返回 taskId(不阻塞)', async () => {
    const exec = makeExecutor();
    const adapter = new ToolLoopAdapter(exec);
    const res = await adapter.submitTask(makeTask());
    expect(res.accepted).toBe(true);
    expect(res.taskId).toBeTruthy();
    // executor.run 被调用(异步,可能未完成,但已触发)
    expect(exec.run).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tn_1' }));
  });

  it('input.prompt 作为执行 prompt;缺省用 task.name+description', async () => {
    const exec = makeExecutor();
    const adapter = new ToolLoopAdapter(exec);
    await adapter.submitTask(makeTask({ input: {}, name: '分析', description: '数据' }));
    const arg = exec.run.mock.calls[0][0];
    expect(arg.prompt).toContain('分析');
    expect(arg.prompt).toContain('数据');
  });

  it('executor 完成后触发 onTaskComplete 回调(带真 conclusion + toolCallsLog)', async () => {
    const exec = makeExecutor({
      conclusion: '最终答案',
      toolCallsLog: [{ toolName: 'search', toolCallId: 'c1', success: true }],
    });
    const adapter = new ToolLoopAdapter(exec);
    const completed = vi.fn();
    adapter.onTaskComplete(completed);

    await adapter.submitTask(makeTask());
    // 等异步执行完成
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 50));

    expect(completed).toHaveBeenCalledTimes(1);
    const result = completed.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.output.conclusion).toBe('最终答案');
    expect(result.output.toolCallsLog).toHaveLength(1);
    expect(result.output.turns).toBe(1);
  });

  it('executor 抛错 → onTaskComplete 带 success:false + error(不吞错)', async () => {
    const exec = {
      run: vi.fn(async () => {
        throw new Error('llm timeout');
      }),
    } as unknown as ToolLoopExecutor;
    const adapter = new ToolLoopAdapter(exec);
    const completed = vi.fn();
    adapter.onTaskComplete(completed);

    await adapter.submitTask(makeTask());
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 50));

    expect(completed).toHaveBeenCalledTimes(1);
    const result = completed.mock.calls[0][0];
    expect(result.success).toBe(false);
    expect(result.error).toContain('llm timeout');
  });

  it('getTaskStatus:完成后状态为 completed + 带 conclusion', async () => {
    const exec = makeExecutor({ conclusion: 'done' });
    const adapter = new ToolLoopAdapter(exec);
    const { taskId } = await adapter.submitTask(makeTask());

    // executeTask 是 void 异步链,完成后状态流转到 completed(mock executor 同步 resolve,可能 submitTask 返回前已完成)
    await new Promise((r) => setTimeout(r, 50));

    const done = await adapter.getTaskStatus(taskId);
    expect(done.state).toBe('completed');
    expect(done.output?.conclusion).toBe('done');
  });

  it('cancelTask:running 时可取消 → state cancelled', async () => {
    const exec = { run: vi.fn(async () => new Promise(() => {})) } as unknown as ToolLoopExecutor;
    const adapter = new ToolLoopAdapter(exec);
    const { taskId } = await adapter.submitTask(makeTask());
    const res = await adapter.cancelTask(taskId);
    expect(res.cancelled).toBe(true);
    const status = await adapter.getTaskStatus(taskId);
    expect(status.state).toBe('cancelled');
  });

  it('listCapabilities 返回工具循环能力', async () => {
    const adapter = new ToolLoopAdapter(makeExecutor());
    const caps = await adapter.listCapabilities();
    expect(caps.length).toBeGreaterThan(0);
  });

  it('healthCheck:executor 可用时 healthy', async () => {
    const adapter = new ToolLoopAdapter(makeExecutor());
    const h = await adapter.healthCheck();
    expect(h.healthy).toBe(true);
  });
});
