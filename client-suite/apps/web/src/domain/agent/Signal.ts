/**
 * Signal — 统一信号值对象
 *
 * 将 DecisionRequest、Notification、GoalAlert、TaskException
 * 等异构来源抽象为统一的 Signal，供优先级排序和推送策略使用。
 */

export type SignalSource =
  | 'decision'
  | 'task-exception'
  | 'goal-alert'
  | 'notification'
  | 'agent-discovery'
  | 'external-alarm'
  | 'collaboration';

export type SignalUrgency = 'critical' | 'high' | 'normal' | 'low';

export type SignalStatus = 'active' | 'acknowledged' | 'resolved' | 'expired';

export interface SignalPayload {
  readonly entityId: string;
  readonly entityType: string;
  readonly title: string;
  readonly detail?: string;
  readonly actionUrl?: string;
}

export interface SignalProps {
  id: string;
  source: SignalSource;
  urgency: SignalUrgency;
  status: SignalStatus;
  deadline: number;
  impactScope: number;
  payload: SignalPayload;
  agentId?: string;
  createdAt: number;
}

export class Signal {
  readonly id: string;
  readonly source: SignalSource;
  readonly urgency: SignalUrgency;
  readonly status: SignalStatus;
  readonly deadline: number;
  readonly impactScope: number;
  readonly payload: SignalPayload;
  readonly agentId: string;
  readonly createdAt: number;

  private constructor(props: SignalProps) {
    this.id = props.id;
    this.source = props.source;
    this.urgency = props.urgency;
    this.status = props.status;
    this.deadline = props.deadline;
    this.impactScope = props.impactScope;
    this.payload = props.payload;
    this.agentId = props.agentId ?? '';
    this.createdAt = props.createdAt;
  }

  static create(props: SignalProps): Signal {
    return new Signal(props);
  }

  acknowledge(): Signal {
    return new Signal({ ...this.toProps(), status: 'acknowledged' });
  }

  resolve(): Signal {
    return new Signal({ ...this.toProps(), status: 'resolved' });
  }

  expire(): Signal {
    return new Signal({ ...this.toProps(), status: 'expired' });
  }

  get isActive(): boolean {
    return this.status === 'active';
  }

  get isExpired(): boolean {
    return this.status === 'expired' || (this.status === 'active' && Date.now() > this.deadline);
  }

  get timeRemaining(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  toProps(): SignalProps {
    return {
      id: this.id,
      source: this.source,
      urgency: this.urgency,
      status: this.status,
      deadline: this.deadline,
      impactScope: this.impactScope,
      payload: this.payload,
      agentId: this.agentId,
      createdAt: this.createdAt,
    };
  }
}
