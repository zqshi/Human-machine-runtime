/**
 * ToolLoopAdapter — 实例任务真执行 adapter(framework='tool-loop'),替代假桩 CockpitAdapter。
 *
 * submitTask 异步不阻塞:构造 ToolLoopExecutor.run 跑 LLM 多轮工具循环,完成时触发
 * onTaskComplete 回调(带真 conclusion + toolCallsLog)。经 registry.invoke 真工具闭环
 * (审批/凭证/租户隔离/计费/callLog),调 LiteLLM 国产模型(不被 SDK 协议绑定)。
 *
 * 与 CockpitAdapter(simulateProgress 假桩)区别:真调 LLM+真执行工具,非 setTimeout 假进度。
 * 与 ClaudeAgentSdkAdapter(worker)区别:不经 claude-agent-sdk,不需 Anthropic tool_use 协议。
 *
 * 详见 docs/architecture/t18-tool-executor-mainline-gap.md + plan moonlit-dreaming-parrot。
 */
import type {
  IAgentRuntimeAdapter,
  AgentFramework,
  AgentTaskInput,
  AgentTaskStatus,
  AgentTaskResult,
  AgentCapability,
} from './agent-runtime-adapter.js';
import type { ToolLoopExecutor } from '../domain/tool-loop-executor.js';
import { newId } from '../../../shared/utils.js';

interface ActiveTask {
  state: AgentTaskStatus;
  startedAt: number;
  abortCtl: AbortController;
  /** 最终态守卫:已置 final 则后续忽略,防重复 onTaskComplete */
  finalState?: 'completed' | 'failed' | 'cancelled';
}

export class ToolLoopAdapter implements IAgentRuntimeAdapter {
  readonly framework: AgentFramework = 'tool-loop';
  readonly version = '1.0.0';

  private tasks = new Map<string, ActiveTask>();
  private completionCallbacks: Array<(result: AgentTaskResult) => void> = [];

  constructor(private readonly executor: ToolLoopExecutor) {}

  async submitTask(task: AgentTaskInput): Promise<{ taskId: string; accepted: boolean }> {
    const taskId = newId('tloop') || task.id;
    const now = new Date();
    const abortCtl = new AbortController();
    const entry: ActiveTask = {
      state: {
        taskId,
        state: 'running',
        progress: 0,
        startedAt: now,
        lastUpdatedAt: now,
      },
      startedAt: Date.now(),
      abortCtl,
    };
    this.tasks.set(taskId, entry);

    // 异步执行(不阻塞 submitTask 返回)
    void this.executeTask(taskId, task, entry).catch(() => {
      // executeTask 内部已处理错误回调,此 catch 兜底防 unhandled rejection
    });

    return { taskId, accepted: true };
  }

  private async executeTask(
    taskId: string,
    task: AgentTaskInput,
    entry: ActiveTask
  ): Promise<void> {
    const prompt = String(task.input?.prompt ?? '').trim() || `${task.name}。${task.description}`;
    try {
      const result = await this.executor.run({
        prompt,
        tenantId: task.tenantId,
        instanceId: task.input?.instanceId ? String(task.input.instanceId) : undefined,
        sessionId: String(task.input?.sessionId ?? ''),
        maxTurns: typeof task.input?.maxTurns === 'number' ? task.input.maxTurns : undefined,
      });
      if (entry.finalState) return; // 已取消

      entry.state.state = 'completed';
      entry.state.progress = 100;
      entry.state.completedAt = new Date();
      entry.state.lastUpdatedAt = new Date();
      entry.state.output = {
        conclusion: result.conclusion,
        toolCallsLog: result.toolCallsLog,
        turns: result.turns,
      };
      entry.finalState = 'completed';

      this.emitComplete({
        taskId,
        success: true,
        output: entry.state.output,
        durationMs: Date.now() - entry.startedAt,
        tokenUsage: result.tokenUsage
          ? {
              prompt: result.tokenUsage.prompt,
              completion: result.tokenUsage.completion,
              total: result.tokenUsage.prompt + result.tokenUsage.completion,
            }
          : undefined,
      });
    } catch (err) {
      if (entry.finalState) return;
      const message = err instanceof Error ? err.message : String(err);
      entry.state.state = 'failed';
      entry.state.error = message;
      entry.state.lastUpdatedAt = new Date();
      entry.finalState = 'failed';

      this.emitComplete({
        taskId,
        success: false,
        output: {},
        error: message,
        durationMs: Date.now() - entry.startedAt,
      });
    }
  }

  private emitComplete(result: AgentTaskResult): void {
    for (const cb of this.completionCallbacks) {
      try {
        cb(result);
      } catch {
        // 回调异常不影响其他回调,防连锁
      }
    }
  }

  async getTaskStatus(taskId: string): Promise<AgentTaskStatus> {
    const entry = this.tasks.get(taskId);
    if (!entry) {
      return {
        taskId,
        state: 'failed',
        progress: 0,
        error: 'Task not found',
        lastUpdatedAt: new Date(),
      };
    }
    return entry.state;
  }

  async cancelTask(taskId: string): Promise<{ cancelled: boolean }> {
    const entry = this.tasks.get(taskId);
    if (!entry || entry.finalState) {
      return { cancelled: false };
    }
    entry.abortCtl.abort();
    entry.state.state = 'cancelled';
    entry.state.lastUpdatedAt = new Date();
    entry.finalState = 'cancelled';
    return { cancelled: true };
  }

  onTaskComplete(callback: (result: AgentTaskResult) => void): () => void {
    this.completionCallbacks.push(callback);
    return () => {
      this.completionCallbacks = this.completionCallbacks.filter((cb) => cb !== callback);
    };
  }

  async listCapabilities(): Promise<AgentCapability[]> {
    return [
      {
        id: 'tool-loop-execution',
        name: '多轮工具循环',
        description: 'LLM 驱动多轮工具调用完成复杂任务',
      },
      { id: 'knowledge-query', name: '知识检索', description: '经工具调用检索知识库' },
      { id: 'task-execution', name: '任务执行', description: '执行带副作用的业务工具(经审批闭环)' },
    ];
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    // executor 无独立健康探活;adapter 本身可用即 healthy(底层 LLM/registry 健康由各自监控)
    return { healthy: true, latencyMs: 0 };
  }
}
