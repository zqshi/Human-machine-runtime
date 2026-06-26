export type AgentFramework =
  | 'openclaw'
  | 'dify'
  | 'coze'
  | 'langchain'
  | 'custom'
  | 'claude-agent-sdk'
  | 'tool-loop';

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
  tokenUsage?: { prompt: number; completion: number; total: number; model?: string };
  durationMs: number;
  /** 失败原因(success=false 时) */
  error?: string;
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

// AdapterRegistry 实现已迁至 ./adapter-registry.ts(sandbox 层)。
// 此处通过 re-export 保留旧 import 路径兼容(agent-runtime-adapter.test.ts / 历史代码)。
export { AdapterRegistry as AgentRuntimeAdapterRegistry } from './adapter-registry.js';
