import { DecisionRequest, type DecisionResponseStatus } from './DecisionRequest';
import type { DecisionSource } from './DecisionHub';

export interface JudgmentContextSnapshot {
  readonly title: string;
  readonly context: string;
  readonly urgency: string;
  readonly recommendationLabel: string;
  readonly alternativeCount: number;
}

export class JudgmentRecord {
  readonly id: string;
  readonly decisionId: string;
  readonly source: DecisionSource;
  readonly action: DecisionResponseStatus;
  readonly selectedOptionId?: string;
  readonly feedback?: string;
  readonly respondedAt: number;
  readonly createdAt: number;
  readonly contextSnapshot: JudgmentContextSnapshot;

  private constructor(props: {
    id: string;
    decisionId: string;
    source: DecisionSource;
    action: DecisionResponseStatus;
    selectedOptionId?: string;
    feedback?: string;
    respondedAt: number;
    createdAt: number;
    contextSnapshot: JudgmentContextSnapshot;
  }) {
    this.id = props.id;
    this.decisionId = props.decisionId;
    this.source = props.source;
    this.action = props.action;
    this.selectedOptionId = props.selectedOptionId;
    this.feedback = props.feedback;
    this.respondedAt = props.respondedAt;
    this.createdAt = props.createdAt;
    this.contextSnapshot = props.contextSnapshot;
  }

  get responseDurationMs(): number {
    return this.respondedAt - this.createdAt;
  }

  static rehydrate(plain: Record<string, unknown>): JudgmentRecord {
    return new JudgmentRecord({
      id: String(plain.id),
      decisionId: String(plain.decisionId),
      source: plain.source as DecisionSource,
      action: plain.action as DecisionResponseStatus,
      selectedOptionId: plain.selectedOptionId as string | undefined,
      feedback: plain.feedback as string | undefined,
      respondedAt: Number(plain.respondedAt),
      createdAt: Number(plain.createdAt),
      contextSnapshot: plain.contextSnapshot as JudgmentContextSnapshot,
    });
  }

  static fromDecisionResponse(decision: DecisionRequest, source: DecisionSource): JudgmentRecord {
    if (decision.isPending) {
      throw new Error('Cannot create JudgmentRecord from a pending DecisionRequest');
    }

    const selectedOptionId =
      decision.responseStatus === 'accepted'
        ? decision.recommendation.id
        : decision.responseStatus === 'modified'
          ? decision.recommendation.id
          : undefined;

    return new JudgmentRecord({
      id: `jr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      decisionId: decision.id,
      source,
      action: decision.responseStatus,
      selectedOptionId,
      feedback: decision.userResponse,
      respondedAt: decision.responseAt ?? Date.now(),
      createdAt: decision.createdAt,
      contextSnapshot: {
        title: decision.title,
        context: decision.context,
        urgency: decision.urgency,
        recommendationLabel: decision.recommendation.label,
        alternativeCount: decision.alternatives.length,
      },
    });
  }
}
