/**
 * AgentScorecard — Agent 绩效记分卡
 *
 * 独立实体，记录 Agent 在考核期内的关键绩效指标。
 */

export interface AgentScorecardProps {
  agentId: string;
  agentName: string;
  periodStart: number;
  periodEnd: number;
  completionRate: number;
  acceptanceRate: number;
  avgTokenCostPerTask: number;
  escalationAccuracyRate: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  totalEscalations: number;
  score: number;
  adjustment: 'promote' | 'maintain' | 'demote';
}

export class AgentScorecard {
  readonly agentId: string;
  readonly agentName: string;
  readonly periodStart: number;
  readonly periodEnd: number;
  readonly completionRate: number;
  readonly acceptanceRate: number;
  readonly avgTokenCostPerTask: number;
  readonly escalationAccuracyRate: number;
  readonly totalTasksCompleted: number;
  readonly totalTasksFailed: number;
  readonly totalEscalations: number;
  readonly score: number;
  readonly adjustment: 'promote' | 'maintain' | 'demote';

  private constructor(props: AgentScorecardProps) {
    this.agentId = props.agentId;
    this.agentName = props.agentName;
    this.periodStart = props.periodStart;
    this.periodEnd = props.periodEnd;
    this.completionRate = props.completionRate;
    this.acceptanceRate = props.acceptanceRate;
    this.avgTokenCostPerTask = props.avgTokenCostPerTask;
    this.escalationAccuracyRate = props.escalationAccuracyRate;
    this.totalTasksCompleted = props.totalTasksCompleted;
    this.totalTasksFailed = props.totalTasksFailed;
    this.totalEscalations = props.totalEscalations;
    this.score = props.score;
    this.adjustment = props.adjustment;
  }

  static compute(props: {
    agentId: string;
    agentName: string;
    periodStart: number;
    periodEnd: number;
    totalTasksCompleted: number;
    totalTasksFailed: number;
    totalTasksAccepted: number;
    totalEscalations: number;
    accurateEscalations: number;
    totalTokenCost: number;
  }): AgentScorecard {
    const totalTasks = props.totalTasksCompleted + props.totalTasksFailed;
    const completionRate = totalTasks > 0 ? props.totalTasksCompleted / totalTasks : 0;
    const acceptanceRate =
      props.totalTasksCompleted > 0 ? props.totalTasksAccepted / props.totalTasksCompleted : 0;
    const escalationAccuracy =
      props.totalEscalations > 0 ? props.accurateEscalations / props.totalEscalations : 1;
    const avgCost = totalTasks > 0 ? props.totalTokenCost / totalTasks : 0;

    const W_COMPLETION = 0.3;
    const W_ACCEPTANCE = 0.3;
    const W_COST = 0.2;
    const W_ESCALATION = 0.2;

    const costScore =
      avgCost <= 500 ? 100 : avgCost >= 5000 ? 0 : Math.round((1 - (avgCost - 500) / 4500) * 100);
    const score =
      completionRate * 100 * W_COMPLETION +
      acceptanceRate * 100 * W_ACCEPTANCE +
      costScore * W_COST +
      escalationAccuracy * 100 * W_ESCALATION;

    let adjustment: 'promote' | 'maintain' | 'demote';
    if (score >= 80) adjustment = 'promote';
    else if (score < 40) adjustment = 'demote';
    else adjustment = 'maintain';

    return new AgentScorecard({
      agentId: props.agentId,
      agentName: props.agentName,
      periodStart: props.periodStart,
      periodEnd: props.periodEnd,
      completionRate,
      acceptanceRate,
      avgTokenCostPerTask: avgCost,
      escalationAccuracyRate: escalationAccuracy,
      totalTasksCompleted: props.totalTasksCompleted,
      totalTasksFailed: props.totalTasksFailed,
      totalEscalations: props.totalEscalations,
      score: Math.round(score * 10) / 10,
      adjustment,
    });
  }

  static fromProps(props: AgentScorecardProps): AgentScorecard {
    return new AgentScorecard(props);
  }

  get totalTasks(): number {
    return this.totalTasksCompleted + this.totalTasksFailed;
  }

  isHighPerformer(): boolean {
    return this.score >= 80;
  }

  isUnderperforming(): boolean {
    return this.score < 40;
  }
}
