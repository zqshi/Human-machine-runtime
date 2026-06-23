import { newId } from '../../../shared/utils.js';
import { estimateCostUsd } from '../domain/pricing.js';
import type {
  IAgentRuntimeAdapter,
  AgentFramework,
  AgentTaskInput,
  AgentTaskStatus,
  AgentTaskResult,
  AgentCapability,
} from './agent-runtime-adapter.js';
import type {
  IWorkerRunner,
  WorkerRunOptions,
  WorkerCallbacks,
} from './infrastructure/docker-worker-runner.js';
import type { InstanceSessionStore } from './infrastructure/instance-session-store.js';

/**
 * ClaudeAgentSdkAdapter 配置。
 * 由 bootstrap.ts 从 config.claude.* 注入,所有字段必须有合法默认值。
 */
export interface ClaudeAdapterConfig {
  apiKey: string;
  workerImage: string;
  workerTimeoutMs: number;
  workspaceRoot: string;
  defaultModel: string;
  defaultMaxTurns: number;
  defaultBudgetUsd: number;
}

const DEFAULT_ALLOWED_TOOLS = [
  'Bash',
  'Write',
  'Edit',
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
];

interface ActiveTask {
  state: AgentTaskStatus;
  abortCtl: AbortController;
  startedAt: number;
  instanceId?: string;
  /** 最终态守卫:已置 final 则后续 onError/onResult/resolve 全部忽略,防重复 emit */
  finalState?: 'completed' | 'failed';
  /** worker 上报的 token 用量(累积值,用于入账);result/progress 事件到达时更新 */
  usage?: { prompt: number; completion: number; total: number; model?: string };
  /** 已用 USD 估算(基于 usage 累积计算);超过 budgetUsd * 1.2 触发熔断 */
  usedUsd: number;
  /** 单任务预算上限(USD);-1 表示不限制 */
  budgetUsd: number;
}

/** 预算熔断宽限系数:估算误差容许 20%(SDK 计数 bug 或估算偏差留余地) */
const BUDGET_OVERRIDE_FACTOR = 1.2;

/**
 * 用 Claude Agent SDK 在 Docker 沙箱中执行 Agent 任务的 adapter。
 *
 * - submitTask:不阻塞,异步调 runner.run,立即返回 taskId
 * - 会话:若 task.input.instanceId 有历史 sessionId,传给 worker 做 resume
 * - 取消:AbortController.abort() → worker SIGTERM → docker --rm 清理
 * - 完成:runner 触发 onResult/onError → state 更新 → onTaskComplete 回调
 *
 * 与 OpenClawAdapter 共存:framework='claude-agent-sdk',registry 路由时按
 * preferredFramework 选择。env 不配 ANTHROPIC_API_KEY 时,bootstrap 不注册本
 * adapter,系统自动降级到 OpenClaw。
 */
export class ClaudeAgentSdkAdapter implements IAgentRuntimeAdapter {
  readonly framework: AgentFramework = 'claude-agent-sdk';
  readonly version = '1.0.0';

  private activeTasks = new Map<string, ActiveTask>();
  private completionCallbacks: Array<(result: AgentTaskResult) => void> = [];

  constructor(
    private readonly runner: IWorkerRunner,
    private readonly sessionStore: InstanceSessionStore,
    private readonly config: ClaudeAdapterConfig
  ) {}

  async submitTask(task: AgentTaskInput): Promise<{ taskId: string; accepted: boolean }> {
    const taskId = newId('cld');
    const input = (task.input ?? {}) as Record<string, unknown>;
    const instanceId = typeof input.instanceId === 'string' ? input.instanceId : undefined;
    const prompt = typeof input.prompt === 'string' ? input.prompt : task.description;

    // 查询 instanceId 是否已有 sessionId(用于 resume)
    const sessionId = instanceId ? await this.sessionStore.getSessionId(instanceId) : undefined;

    const state: AgentTaskStatus = {
      taskId,
      state: 'dispatched',
      progress: 0,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    const abortCtl = new AbortController();
    const budgetUsd =
      typeof (input.maxBudgetUsd as number) === 'number'
        ? (input.maxBudgetUsd as number)
        : this.config.defaultBudgetUsd;
    this.activeTasks.set(taskId, {
      state,
      abortCtl,
      startedAt: Date.now(),
      instanceId,
      usedUsd: 0,
      budgetUsd,
    });

    const opts: WorkerRunOptions = {
      taskId,
      prompt,
      sessionId,
      instanceId,
      tenantId: task.tenantId,
      cwd: `${this.config.workspaceRoot}/${taskId}`,
      allowedTools: parseAllowedTools(input.allowedTools),
      model: typeof input.model === 'string' ? input.model : this.config.defaultModel,
      maxTurns: typeof input.maxTurns === 'number' ? input.maxTurns : this.config.defaultMaxTurns,
      maxBudgetUsd: budgetUsd,
      timeoutMs: typeof task.timeout === 'number' ? task.timeout : this.config.workerTimeoutMs,
      apiKey: this.config.apiKey,
      workerImage: this.config.workerImage,
    };

    // 异步执行,submitTask 立即返回
    this.executeTask(taskId, opts, abortCtl).catch((err) => {
      this.markFailed(taskId, err instanceof Error ? err : new Error(String(err)));
    });

    return { taskId, accepted: true };
  }

  async getTaskStatus(taskId: string): Promise<AgentTaskStatus> {
    const active = this.activeTasks.get(taskId);
    if (!active) {
      return {
        taskId,
        state: 'failed',
        progress: 0,
        error: 'Task not found',
        lastUpdatedAt: new Date(),
      };
    }
    return { ...active.state };
  }

  async cancelTask(taskId: string): Promise<{ cancelled: boolean }> {
    const active = this.activeTasks.get(taskId);
    if (!active) return { cancelled: false };
    if (
      active.state.state === 'completed' ||
      active.state.state === 'failed' ||
      active.state.state === 'cancelled'
    ) {
      return { cancelled: false };
    }
    active.abortCtl.abort();
    active.state.state = 'cancelled';
    active.state.lastUpdatedAt = new Date();
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
        id: 'text-generation',
        name: '文本生成',
        description: '生成文档、报告、邮件等文本内容',
      },
      {
        id: 'code-execution',
        name: '代码执行',
        description: '在沙箱中编写并运行代码完成自动化任务',
      },
      {
        id: 'information-retrieval',
        name: '信息检索',
        description: '联网搜索 / 抓取页面 / 知识检索',
      },
      {
        id: 'workflow-orchestration',
        name: '流程编排',
        description: '编排多步骤工作流,跨工具协作',
      },
    ];
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const ok = await this.runner.checkImageAvailable(this.config.workerImage);
      return { healthy: ok, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  private async executeTask(
    taskId: string,
    opts: WorkerRunOptions,
    abortCtl: AbortController
  ): Promise<void> {
    const active = this.activeTasks.get(taskId);
    if (!active) return;

    const cbs: WorkerCallbacks = {
      onProgress: (p) => {
        const a = this.activeTasks.get(taskId);
        if (!a || a.state.state === 'cancelled' || a.finalState) return;
        a.state.progress = p.progress;
        a.state.lastUpdatedAt = new Date();
      },
      onSessionId: (sid) => {
        if (active.instanceId) {
          this.sessionStore.setSessionId(active.instanceId, sid).catch(() => {
            // 持久化失败不影响任务执行
          });
        }
      },
      /**
       * result 暂存到 state.output 但不立即 mark completed。
       * 等 runner.run resolves(进程正常退出 0)才确认成功。
       * 若 worker 进程 exit ≠ 0,会先/后触发 onError → mark failed,
       * 此时 result 内容(如 'Invalid API key')只是诊断信息。
       */
      onResult: (r) => {
        const a = this.activeTasks.get(taskId);
        if (!a || a.finalState) return;
        a.state.output = { summary: r.result };
        a.state.progress = 100;
        a.state.lastUpdatedAt = new Date();
        if (r.usage) {
          a.usage = {
            prompt: r.usage.inputTokens,
            completion: r.usage.outputTokens,
            total: r.usage.inputTokens + r.usage.outputTokens,
            ...(r.usage.model ? { model: r.usage.model } : {}),
          };
          // 累计 USD 估算(SDK result.usage 是整次会话的总累积)
          const model = r.usage.model ?? opts.model;
          a.usedUsd = estimateCostUsd(model, r.usage.inputTokens, r.usage.outputTokens);
          // 预算二次熔断:超阈值立即 abort + mark failed
          if (
            a.budgetUsd > 0 &&
            a.usedUsd > a.budgetUsd * BUDGET_OVERRIDE_FACTOR &&
            !a.finalState
          ) {
            a.abortCtl.abort();
            this.markFailed(
              taskId,
              new Error(
                `budget cap exceeded: used $${a.usedUsd.toFixed(4)} > budget $${a.budgetUsd} × ${BUDGET_OVERRIDE_FACTOR}`
              )
            );
          }
        }
      },
      onError: (err) => {
        this.markFailed(taskId, err);
      },
    };

    try {
      await this.runner.run(opts, cbs, abortCtl);
    } catch (err) {
      this.markFailed(taskId, err instanceof Error ? err : new Error(String(err)));
      return;
    }

    this.markCompleted(taskId);
  }

  private markCompleted(taskId: string): void {
    const a = this.activeTasks.get(taskId);
    if (!a || a.finalState) return;
    // 被 cancel 或在 runner.run 期间已 failed,跳过
    if (a.state.state === 'cancelled') return;
    a.finalState = 'completed';
    a.state.state = 'completed';
    a.state.progress = 100;
    a.state.completedAt = new Date();
    a.state.lastUpdatedAt = new Date();
    this.emitComplete(a, true, a.state.output ?? {});
  }

  private markFailed(taskId: string, err: Error): void {
    const a = this.activeTasks.get(taskId);
    if (!a || a.finalState) return;
    if (a.state.state === 'cancelled') return;
    a.finalState = 'failed';
    a.state.state = 'failed';
    a.state.error = err.message;
    a.state.lastUpdatedAt = new Date();
    this.emitComplete(a, false, a.state.output ?? {}, err.message);
  }

  private emitComplete(
    active: ActiveTask,
    success: boolean,
    output: Record<string, unknown>,
    errorMessage?: string
  ): void {
    const result: AgentTaskResult = {
      taskId: active.state.taskId,
      success,
      output,
      durationMs: Date.now() - active.startedAt,
      ...(active.usage ? { tokenUsage: active.usage } : {}),
      ...(errorMessage ? { error: errorMessage } : {}),
    };
    for (const cb of [...this.completionCallbacks]) {
      try {
        cb(result);
      } catch {
        // 单个 callback 抛错不影响其他订阅者
      }
    }
  }
}

function parseAllowedTools(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_ALLOWED_TOOLS;
  return value.filter((t): t is string => typeof t === 'string');
}
