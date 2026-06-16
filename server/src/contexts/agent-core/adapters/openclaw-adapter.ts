import type {
  IAgentRuntimeAdapter,
  AgentFramework,
  AgentTaskInput,
  AgentTaskStatus,
  AgentTaskResult,
  AgentCapability,
} from '../domain/agent-runtime-adapter.js';
import type { ClawManagerClient } from '../../gateway/clients/claw-manager-client.js';
import { newId } from '../../../shared/utils.js';

export class OpenClawAdapter implements IAgentRuntimeAdapter {
  readonly framework: AgentFramework = 'openclaw';
  readonly version = '1.0.0';

  private clawManagerClient: ClawManagerClient;
  private completionCallbacks: Array<(result: AgentTaskResult) => void> = [];
  private taskMap = new Map<string, { state: AgentTaskStatus; startedAt: number }>();

  constructor(clawManagerClient: ClawManagerClient) {
    this.clawManagerClient = clawManagerClient;
  }

  async submitTask(task: AgentTaskInput): Promise<{ taskId: string; accepted: boolean }> {
    const taskId = newId('oct');
    const now = new Date();

    this.taskMap.set(taskId, {
      state: {
        taskId,
        state: 'dispatched',
        progress: 0,
        startedAt: now,
        lastUpdatedAt: now,
      },
      startedAt: Date.now(),
    });

    setTimeout(() => this.simulateProgress(taskId, task), 100);

    return { taskId, accepted: true };
  }

  async getTaskStatus(taskId: string): Promise<AgentTaskStatus> {
    const entry = this.taskMap.get(taskId);
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
    const entry = this.taskMap.get(taskId);
    if (!entry || entry.state.state === 'completed' || entry.state.state === 'failed') {
      return { cancelled: false };
    }
    entry.state.state = 'cancelled';
    entry.state.lastUpdatedAt = new Date();
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
        id: 'data-analysis',
        name: '数据分析',
        description: '分析数据、生成图表和洞察',
      },
      {
        id: 'code-execution',
        name: '代码执行',
        description: '编写和运行代码完成自动化任务',
      },
      {
        id: 'information-retrieval',
        name: '信息检索',
        description: '从知识库和外部源检索信息',
      },
      {
        id: 'workflow-orchestration',
        name: '流程编排',
        description: '编排多步骤工作流',
      },
    ];
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.clawManagerClient.listInstances(1, 1);
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  private simulateProgress(taskId: string, _task: AgentTaskInput): void {
    const entry = this.taskMap.get(taskId);
    if (!entry) return;

    entry.state.state = 'running';
    entry.state.progress = 30;
    entry.state.lastUpdatedAt = new Date();

    setTimeout(() => {
      const current = this.taskMap.get(taskId);
      if (!current || current.state.state === 'cancelled') return;

      current.state.state = 'completed';
      current.state.progress = 100;
      current.state.completedAt = new Date();
      current.state.lastUpdatedAt = new Date();
      current.state.output = { summary: '任务执行完成' };

      const result: AgentTaskResult = {
        taskId,
        success: true,
        output: current.state.output,
        durationMs: Date.now() - current.startedAt,
      };

      for (const cb of this.completionCallbacks) {
        cb(result);
      }
    }, 5000);
  }
}
