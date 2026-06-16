/**
 * JudgmentObjective — L1 判断目标
 *
 * 承接 L0 的判断维度目标：
 * keyQuestion + cadence + linkedDecisionIds + accuracyRate
 */

export type JudgmentCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export interface JudgmentObjectiveProps {
  id: string;
  l0Id: string;
  keyQuestion: string;
  description: string;
  cadence: JudgmentCadence;
  linkedDecisionIds: string[];
  accuracyRate: number;
  targetAccuracyRate: number;
  status: 'active' | 'paused' | 'achieved' | 'abandoned';
  createdAt: number;
  updatedAt: number;
}

export class JudgmentObjective {
  readonly id: string;
  readonly l0Id: string;
  readonly keyQuestion: string;
  readonly description: string;
  readonly cadence: JudgmentCadence;
  readonly linkedDecisionIds: readonly string[];
  readonly accuracyRate: number;
  readonly targetAccuracyRate: number;
  readonly status: JudgmentObjectiveProps['status'];
  readonly createdAt: number;
  readonly updatedAt: number;

  private constructor(props: JudgmentObjectiveProps) {
    this.id = props.id;
    this.l0Id = props.l0Id;
    this.keyQuestion = props.keyQuestion;
    this.description = props.description;
    this.cadence = props.cadence;
    this.linkedDecisionIds = props.linkedDecisionIds;
    this.accuracyRate = props.accuracyRate;
    this.targetAccuracyRate = props.targetAccuracyRate;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: {
    l0Id: string;
    keyQuestion: string;
    description: string;
    cadence: JudgmentCadence;
    targetAccuracyRate?: number;
  }): JudgmentObjective {
    const now = Date.now();
    return new JudgmentObjective({
      id: `l1-${now}-${Math.random().toString(36).slice(2, 7)}`,
      l0Id: props.l0Id,
      keyQuestion: props.keyQuestion,
      description: props.description,
      cadence: props.cadence,
      linkedDecisionIds: [],
      accuracyRate: 0,
      targetAccuracyRate: props.targetAccuracyRate ?? 0.8,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: JudgmentObjectiveProps): JudgmentObjective {
    return new JudgmentObjective(props);
  }

  linkDecision(decisionId: string): JudgmentObjective {
    if (this.linkedDecisionIds.includes(decisionId)) return this;
    return new JudgmentObjective({
      ...this.toProps(),
      linkedDecisionIds: [...this.linkedDecisionIds, decisionId],
      updatedAt: Date.now(),
    });
  }

  updateAccuracy(rate: number): JudgmentObjective {
    return new JudgmentObjective({
      ...this.toProps(),
      accuracyRate: Math.max(0, Math.min(1, rate)),
      updatedAt: Date.now(),
    });
  }

  get isOnTarget(): boolean {
    return this.accuracyRate >= this.targetAccuracyRate;
  }

  get gap(): number {
    return Math.max(0, this.targetAccuracyRate - this.accuracyRate);
  }

  private toProps(): JudgmentObjectiveProps {
    return {
      id: this.id,
      l0Id: this.l0Id,
      keyQuestion: this.keyQuestion,
      description: this.description,
      cadence: this.cadence,
      linkedDecisionIds: [...this.linkedDecisionIds],
      accuracyRate: this.accuracyRate,
      targetAccuracyRate: this.targetAccuracyRate,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
