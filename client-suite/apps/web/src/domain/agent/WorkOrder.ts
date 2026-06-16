/**
 * WorkOrder — 协作工单实体
 *
 * 当 Agent 判断某个子任务需要其他角色参与时，生成 WorkOrder。
 * AI 先尝试预回答（confidence），置信度不足时升维到人类协作者处理。
 */

export type WorkOrderType = 'approval' | 'review' | 'input' | 'decision';
export type WorkOrderStatus = 'pending' | 'completed' | 'expired' | 'auto_resolved';

export interface WorkOrderProps {
  id: string;
  type: WorkOrderType;
  fromUserId: string;
  toUserId: string;
  goalId: string;
  taskId?: string;
  title: string;
  context: string;
  aiSuggestion?: string;
  confidence?: number;
  status: WorkOrderStatus;
  response?: string;
  respondedAt?: number;
  deadline: number;
  createdAt: number;
}

export class WorkOrder {
  readonly id: string;
  readonly type: WorkOrderType;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly goalId: string;
  readonly taskId?: string;
  readonly title: string;
  readonly context: string;
  readonly aiSuggestion?: string;
  readonly confidence: number;
  readonly status: WorkOrderStatus;
  readonly response?: string;
  readonly respondedAt?: number;
  readonly deadline: number;
  readonly createdAt: number;

  private constructor(props: WorkOrderProps) {
    this.id = props.id;
    this.type = props.type;
    this.fromUserId = props.fromUserId;
    this.toUserId = props.toUserId;
    this.goalId = props.goalId;
    this.taskId = props.taskId;
    this.title = props.title;
    this.context = props.context;
    this.aiSuggestion = props.aiSuggestion;
    this.confidence = props.confidence ?? 0;
    this.status = props.status;
    this.response = props.response;
    this.respondedAt = props.respondedAt;
    this.deadline = props.deadline;
    this.createdAt = props.createdAt;
  }

  static create(props: WorkOrderProps): WorkOrder {
    return new WorkOrder(props);
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isExpired(): boolean {
    return this.status === 'pending' && Date.now() > this.deadline;
  }

  get isHighConfidence(): boolean {
    return this.confidence >= 0.9;
  }

  complete(response: string): WorkOrder {
    if (!this.isPending) return this;
    return new WorkOrder({
      ...this.toProps(),
      status: 'completed',
      response,
      respondedAt: Date.now(),
    });
  }

  autoResolve(): WorkOrder {
    if (!this.isPending || !this.isHighConfidence) return this;
    return new WorkOrder({
      ...this.toProps(),
      status: 'auto_resolved',
      response: this.aiSuggestion,
      respondedAt: Date.now(),
    });
  }

  expire(): WorkOrder {
    if (!this.isPending) return this;
    return new WorkOrder({
      ...this.toProps(),
      status: 'expired',
    });
  }

  toProps(): WorkOrderProps {
    return {
      id: this.id,
      type: this.type,
      fromUserId: this.fromUserId,
      toUserId: this.toUserId,
      goalId: this.goalId,
      taskId: this.taskId,
      title: this.title,
      context: this.context,
      aiSuggestion: this.aiSuggestion,
      confidence: this.confidence,
      status: this.status,
      response: this.response,
      respondedAt: this.respondedAt,
      deadline: this.deadline,
      createdAt: this.createdAt,
    };
  }
}
