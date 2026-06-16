export type AgentFramework = 'openclaw' | 'dify' | 'coze' | 'langchain' | 'custom';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type TaskState =
  | 'pending'
  | 'dispatched'
  | 'running'
  | 'human_confirm'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface AgentTaskInput {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  priority: TaskPriority;
  input: Record<string, unknown>;
  timeout?: number;
  requireHumanConfirm?: boolean;
  callbackUrl?: string;
}

export interface AgentTaskStatus {
  taskId: string;
  state: TaskState;
  progress: number;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  lastUpdatedAt: Date;
}

export interface AgentTaskResult {
  taskId: string;
  success: boolean;
  output: Record<string, unknown>;
  artifacts?: Array<{ type: string; uri: string; name: string }>;
  tokenUsage?: { prompt: number; completion: number; total: number };
  durationMs: number;
}

export interface IAgentRuntimeAdapter {
  readonly framework: AgentFramework;
  readonly version: string;

  submitTask(task: AgentTaskInput): Promise<{ taskId: string; accepted: boolean }>;
  getTaskStatus(taskId: string): Promise<AgentTaskStatus>;
  cancelTask(taskId: string): Promise<{ cancelled: boolean }>;
  onTaskComplete(callback: (result: AgentTaskResult) => void): () => void;
  listCapabilities(): Promise<AgentCapability[]>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
}

export class AgentRuntimeAdapterRegistry {
  private adapters = new Map<AgentFramework, IAgentRuntimeAdapter>();

  register(adapter: IAgentRuntimeAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  unregister(framework: AgentFramework): void {
    this.adapters.delete(framework);
  }

  get(framework: AgentFramework): IAgentRuntimeAdapter | undefined {
    return this.adapters.get(framework);
  }

  listRegistered(): AgentFramework[] {
    return Array.from(this.adapters.keys());
  }

  async dispatchTask(
    task: AgentTaskInput,
    preferredFramework?: AgentFramework
  ): Promise<{ taskId: string; framework: AgentFramework }> {
    const adapter = preferredFramework
      ? this.adapters.get(preferredFramework)
      : this.selectBestAdapter(task);

    if (!adapter) {
      throw new Error(
        preferredFramework
          ? `Agent framework "${preferredFramework}" not registered`
          : 'No agent runtime adapter available'
      );
    }

    const result = await adapter.submitTask(task);
    return { taskId: result.taskId, framework: adapter.framework };
  }

  private selectBestAdapter(_task: AgentTaskInput): IAgentRuntimeAdapter | undefined {
    const adapters = Array.from(this.adapters.values());
    return adapters[0];
  }

  async healthCheckAll(): Promise<
    Array<{ framework: AgentFramework; healthy: boolean; latencyMs: number }>
  > {
    const results: Array<{ framework: AgentFramework; healthy: boolean; latencyMs: number }> = [];
    for (const adapter of this.adapters.values()) {
      try {
        const health = await adapter.healthCheck();
        results.push({ framework: adapter.framework, ...health });
      } catch {
        results.push({ framework: adapter.framework, healthy: false, latencyMs: -1 });
      }
    }
    return results;
  }
}
