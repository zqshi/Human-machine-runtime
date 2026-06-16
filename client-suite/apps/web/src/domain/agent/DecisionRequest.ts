/**
 * DecisionRequest — AI 决策请求实体
 *
 * 当 AI 在自主执行过程中遇到需要人类判断的节点时，
 * 创建 DecisionRequest 推送到用户侧。用户可采纳、修改、拒绝或延后。
 */
export type DecisionUrgency = 'critical' | 'high' | 'normal' | 'low';
export type DecisionResponseStatus =
  | 'pending'
  | 'accepted'
  | 'modified'
  | 'declined'
  | 'deferred'
  | 'expired';

export interface RecommendationOption {
  id: string;
  label: string;
  description: string;
  reasoning: string;
  estimatedImpact: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface DecisionRequestProps {
  id: string;
  agentId: string;
  title: string;
  context: string;
  recommendation: RecommendationOption;
  alternatives: RecommendationOption[];
  urgency: DecisionUrgency;
  deadline: number;
  responseStatus: DecisionResponseStatus;
  sourceNotificationId?: string;
  relatedTaskIds?: string[];
  userResponse?: string;
  responseAt?: number;
  createdAt: number;
  impactScope?: number;
  downstreamTaskIds?: string[];
  downstreamGoalIds?: string[];
}

export class DecisionRequest {
  readonly id: string;
  readonly agentId: string;
  readonly title: string;
  readonly context: string;
  readonly recommendation: RecommendationOption;
  readonly alternatives: RecommendationOption[];
  readonly urgency: DecisionUrgency;
  readonly deadline: number;
  readonly responseStatus: DecisionResponseStatus;
  readonly sourceNotificationId?: string;
  readonly relatedTaskIds: string[];
  readonly userResponse?: string;
  readonly responseAt?: number;
  readonly createdAt: number;
  readonly impactScope: number;
  readonly downstreamTaskIds: string[];
  readonly downstreamGoalIds: string[];

  private constructor(props: DecisionRequestProps) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.title = props.title;
    this.context = props.context;
    this.recommendation = props.recommendation;
    this.alternatives = props.alternatives;
    this.urgency = props.urgency;
    this.deadline = props.deadline;
    this.responseStatus = props.responseStatus;
    this.sourceNotificationId = props.sourceNotificationId;
    this.relatedTaskIds = props.relatedTaskIds ?? [];
    this.userResponse = props.userResponse;
    this.responseAt = props.responseAt;
    this.createdAt = props.createdAt;
    this.impactScope = props.impactScope ?? 0;
    this.downstreamTaskIds = props.downstreamTaskIds ?? [];
    this.downstreamGoalIds = props.downstreamGoalIds ?? [];
  }

  static create(props: DecisionRequestProps): DecisionRequest {
    return new DecisionRequest(props);
  }

  accept(): DecisionRequest {
    return new DecisionRequest({
      ...this.toProps(),
      responseStatus: 'accepted',
      responseAt: Date.now(),
    });
  }

  modify(optionId: string, feedback: string): DecisionRequest {
    const option = [...this.alternatives, this.recommendation].find((o) => o.id === optionId);
    return new DecisionRequest({
      ...this.toProps(),
      responseStatus: 'modified',
      userResponse: feedback,
      recommendation: option ?? this.recommendation,
      responseAt: Date.now(),
    });
  }

  decline(reason: string): DecisionRequest {
    return new DecisionRequest({
      ...this.toProps(),
      responseStatus: 'declined',
      userResponse: reason,
      responseAt: Date.now(),
    });
  }

  defer(until: number): DecisionRequest {
    return new DecisionRequest({
      ...this.toProps(),
      responseStatus: 'deferred',
      responseAt: Date.now(),
      deadline: until,
    });
  }

  expire(): DecisionRequest {
    return new DecisionRequest({
      ...this.toProps(),
      responseStatus: 'expired',
    });
  }

  get isExpired(): boolean {
    return Date.now() > this.deadline && this.responseStatus === 'pending';
  }

  get isPending(): boolean {
    return this.responseStatus === 'pending';
  }

  get timeRemaining(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  private toProps(): DecisionRequestProps {
    return {
      id: this.id,
      agentId: this.agentId,
      title: this.title,
      context: this.context,
      recommendation: this.recommendation,
      alternatives: this.alternatives,
      urgency: this.urgency,
      deadline: this.deadline,
      responseStatus: this.responseStatus,
      sourceNotificationId: this.sourceNotificationId,
      relatedTaskIds: this.relatedTaskIds,
      userResponse: this.userResponse,
      responseAt: this.responseAt,
      createdAt: this.createdAt,
      impactScope: this.impactScope,
      downstreamTaskIds: this.downstreamTaskIds,
      downstreamGoalIds: this.downstreamGoalIds,
    };
  }
}
