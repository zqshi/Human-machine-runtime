import type { AgentRuntimeStatus, ChannelType } from '../shared/types';

export interface ChannelConnection {
  channelType: ChannelType;
  status: 'connected' | 'disconnected' | 'syncing';
  lastSyncAt: number;
}

export interface AgentRuntimeProps {
  agentId: string;
  runtimeStatus: AgentRuntimeStatus;
  currentTaskId: string | null;
  tokenUsage: number;
  lastActiveAt: number;
  connectedChannels: ChannelConnection[];
  pendingDecisionIds?: string[];
}

export class AgentRuntime {
  readonly agentId: string;
  readonly runtimeStatus: AgentRuntimeStatus;
  readonly currentTaskId: string | null;
  readonly tokenUsage: number;
  readonly lastActiveAt: number;
  readonly connectedChannels: ChannelConnection[];
  readonly pendingDecisionIds: string[];

  private constructor(props: AgentRuntimeProps) {
    this.agentId = props.agentId;
    this.runtimeStatus = props.runtimeStatus;
    this.currentTaskId = props.currentTaskId;
    this.tokenUsage = props.tokenUsage;
    this.lastActiveAt = props.lastActiveAt;
    this.connectedChannels = props.connectedChannels;
    this.pendingDecisionIds = props.pendingDecisionIds ?? [];
  }

  static create(props: AgentRuntimeProps): AgentRuntime {
    return new AgentRuntime(props);
  }

  get isActive(): boolean {
    return this.runtimeStatus === 'working' || this.runtimeStatus === 'monitoring';
  }

  withStatus(status: AgentRuntimeStatus): AgentRuntime {
    return new AgentRuntime({ ...this.toProps(), runtimeStatus: status, lastActiveAt: Date.now() });
  }

  withTokenUsage(delta: number): AgentRuntime {
    return new AgentRuntime({ ...this.toProps(), tokenUsage: this.tokenUsage + delta });
  }

  withTask(taskId: string | null): AgentRuntime {
    return new AgentRuntime({
      ...this.toProps(),
      currentTaskId: taskId,
      runtimeStatus: taskId ? 'working' : 'idle',
      lastActiveAt: Date.now(),
    });
  }

  private toProps(): AgentRuntimeProps {
    return {
      agentId: this.agentId,
      runtimeStatus: this.runtimeStatus,
      currentTaskId: this.currentTaskId,
      tokenUsage: this.tokenUsage,
      lastActiveAt: this.lastActiveAt,
      connectedChannels: this.connectedChannels,
      pendingDecisionIds: this.pendingDecisionIds,
    };
  }
}
