import type { AgentTaskStatus } from '../shared/types';
import type { ReasoningStep } from '../notification/Notification';

export interface AgentSubtask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
}

export interface ExecutionLog {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

export interface AgentTaskProps {
  id: string;
  agentId: string;
  todoId: string;
  name: string;
  status: AgentTaskStatus;
  progress: number;
  subtasks: AgentSubtask[];
  logs: ExecutionLog[];
  color: string;
  createdAt: number;
  updatedAt: number;
  reasoningSteps?: ReasoningStep[];
}

export class AgentTask {
  readonly id: string;
  readonly agentId: string;
  readonly todoId: string;
  readonly name: string;
  readonly status: AgentTaskStatus;
  readonly progress: number;
  readonly subtasks: AgentSubtask[];
  readonly logs: ExecutionLog[];
  readonly color: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly reasoningSteps?: ReasoningStep[];

  private constructor(props: AgentTaskProps) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.todoId = props.todoId;
    this.name = props.name;
    this.status = props.status;
    this.progress = props.progress;
    this.subtasks = props.subtasks;
    this.logs = props.logs;
    this.color = props.color;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.reasoningSteps = props.reasoningSteps;
  }

  static create(props: AgentTaskProps): AgentTask {
    return new AgentTask(props);
  }

  get isActive(): boolean {
    return this.status === 'running' || this.status === 'queued';
  }

  get isTerminal(): boolean {
    return this.status === 'completed' || this.status === 'failed';
  }

  get canPause(): boolean {
    return this.status === 'running';
  }

  get canResume(): boolean {
    return this.status === 'paused';
  }

  get canCancel(): boolean {
    return this.status === 'running' || this.status === 'paused' || this.status === 'queued';
  }

  pause(): AgentTask {
    if (!this.canPause) return this;
    return new AgentTask({ ...this.toProps(), status: 'paused', updatedAt: Date.now() });
  }

  resume(): AgentTask {
    if (!this.canResume) return this;
    return new AgentTask({ ...this.toProps(), status: 'running', updatedAt: Date.now() });
  }

  cancel(): AgentTask {
    if (!this.canCancel) return this;
    return new AgentTask({ ...this.toProps(), status: 'failed', updatedAt: Date.now() });
  }

  withProgress(progress: number): AgentTask {
    return new AgentTask({ ...this.toProps(), progress: Math.min(100, progress), updatedAt: Date.now() });
  }

  withStatus(status: AgentTaskStatus): AgentTask {
    return new AgentTask({ ...this.toProps(), status, updatedAt: Date.now() });
  }

  addLog(log: ExecutionLog): AgentTask {
    return new AgentTask({ ...this.toProps(), logs: [...this.logs, log], updatedAt: Date.now() });
  }

  updateSubtask(subtaskId: string, status: AgentSubtask['status']): AgentTask {
    return new AgentTask({
      ...this.toProps(),
      subtasks: this.subtasks.map((s) => (s.id === subtaskId ? { ...s, status } : s)),
      updatedAt: Date.now(),
    });
  }

  withReasoningSteps(steps: ReasoningStep[]): AgentTask {
    return new AgentTask({ ...this.toProps(), reasoningSteps: steps });
  }

  private toProps(): AgentTaskProps {
    return {
      id: this.id,
      agentId: this.agentId,
      todoId: this.todoId,
      name: this.name,
      status: this.status,
      progress: this.progress,
      subtasks: this.subtasks,
      logs: this.logs,
      color: this.color,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      reasoningSteps: this.reasoningSteps,
    };
  }
}
