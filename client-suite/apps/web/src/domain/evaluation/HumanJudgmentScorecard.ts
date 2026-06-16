/**
 * HumanJudgmentScorecard — 人的判断质量记分卡
 *
 * 独立实体，评估决策者在考核期内的判断质量。
 */

export interface HumanJudgmentScorecardProps {
  userId: string;
  userName: string;
  periodStart: number;
  periodEnd: number;
  accuracyRate: number;
  timelinessRate: number;
  correctionEffectiveness: number;
  knowledgeContribution: number;
  totalDecisions: number;
  correctDecisions: number;
  avgResponseMs: number;
  correctionsApplied: number;
  patternsContributed: number;
  score: number;
  adjustment: 'promote' | 'maintain' | 'demote';
}

export class HumanJudgmentScorecard {
  readonly userId: string;
  readonly userName: string;
  readonly periodStart: number;
  readonly periodEnd: number;
  readonly accuracyRate: number;
  readonly timelinessRate: number;
  readonly correctionEffectiveness: number;
  readonly knowledgeContribution: number;
  readonly totalDecisions: number;
  readonly correctDecisions: number;
  readonly avgResponseMs: number;
  readonly correctionsApplied: number;
  readonly patternsContributed: number;
  readonly score: number;
  readonly adjustment: 'promote' | 'maintain' | 'demote';

  private constructor(props: HumanJudgmentScorecardProps) {
    this.userId = props.userId;
    this.userName = props.userName;
    this.periodStart = props.periodStart;
    this.periodEnd = props.periodEnd;
    this.accuracyRate = props.accuracyRate;
    this.timelinessRate = props.timelinessRate;
    this.correctionEffectiveness = props.correctionEffectiveness;
    this.knowledgeContribution = props.knowledgeContribution;
    this.totalDecisions = props.totalDecisions;
    this.correctDecisions = props.correctDecisions;
    this.avgResponseMs = props.avgResponseMs;
    this.correctionsApplied = props.correctionsApplied;
    this.patternsContributed = props.patternsContributed;
    this.score = props.score;
    this.adjustment = props.adjustment;
  }

  static compute(props: {
    userId: string;
    userName: string;
    periodStart: number;
    periodEnd: number;
    totalDecisions: number;
    correctDecisions: number;
    timelyDecisions: number;
    avgResponseMs: number;
    correctionsApplied: number;
    effectiveCorrections: number;
    patternsContributed: number;
  }): HumanJudgmentScorecard {
    const accuracyRate =
      props.totalDecisions > 0 ? props.correctDecisions / props.totalDecisions : 0;
    const timelinessRate =
      props.totalDecisions > 0 ? props.timelyDecisions / props.totalDecisions : 0;
    const correctionEffectiveness =
      props.correctionsApplied > 0 ? props.effectiveCorrections / props.correctionsApplied : 1;
    const knowledgeContribution = Math.min(props.patternsContributed / 5, 1);

    const W_ACCURACY = 0.35;
    const W_TIMELINESS = 0.25;
    const W_CORRECTION = 0.25;
    const W_KNOWLEDGE = 0.15;

    const score =
      accuracyRate * 100 * W_ACCURACY +
      timelinessRate * 100 * W_TIMELINESS +
      correctionEffectiveness * 100 * W_CORRECTION +
      knowledgeContribution * 100 * W_KNOWLEDGE;

    let adjustment: 'promote' | 'maintain' | 'demote';
    if (score >= 80) adjustment = 'promote';
    else if (score < 40) adjustment = 'demote';
    else adjustment = 'maintain';

    return new HumanJudgmentScorecard({
      userId: props.userId,
      userName: props.userName,
      periodStart: props.periodStart,
      periodEnd: props.periodEnd,
      accuracyRate,
      timelinessRate,
      correctionEffectiveness,
      knowledgeContribution,
      totalDecisions: props.totalDecisions,
      correctDecisions: props.correctDecisions,
      avgResponseMs: props.avgResponseMs,
      correctionsApplied: props.correctionsApplied,
      patternsContributed: props.patternsContributed,
      score: Math.round(score * 10) / 10,
      adjustment,
    });
  }

  static fromProps(props: HumanJudgmentScorecardProps): HumanJudgmentScorecard {
    return new HumanJudgmentScorecard(props);
  }

  isHighPerformer(): boolean {
    return this.score >= 80;
  }

  isUnderperforming(): boolean {
    return this.score < 40;
  }
}
