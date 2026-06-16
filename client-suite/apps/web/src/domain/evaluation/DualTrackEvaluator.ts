/**
 * DualTrackEvaluator — 双轨考核引擎
 *
 * Agent 绩效卡 + 人的判断质量卡，统一评估框架。
 */

export interface AgentScorecard {
  readonly agentId: string;
  readonly name: string;
  readonly completionRate: number;
  readonly acceptanceRate: number;
  readonly avgTokenCost: number;
  readonly escalationAccuracy: number;
  readonly totalTasks: number;
  readonly period: string;
  readonly score: number;
}

export interface HumanJudgmentScorecard {
  readonly userId: string;
  readonly name: string;
  readonly accuracyRate: number;
  readonly timelinessRate: number;
  readonly correctionEffectiveness: number;
  readonly knowledgeContribution: number;
  readonly totalJudgments: number;
  readonly period: string;
  readonly score: number;
}

export interface EvaluationResult {
  readonly agentScorecards: AgentScorecard[];
  readonly humanScorecards: HumanJudgmentScorecard[];
  readonly adjustments: EvaluationAdjustment[];
  readonly evaluatedAt: number;
}

export interface EvaluationAdjustment {
  readonly targetId: string;
  readonly targetType: 'agent' | 'human';
  readonly adjustment: 'promote' | 'maintain' | 'demote';
  readonly reason: string;
  readonly newWeight: number;
}

const AGENT_WEIGHTS = {
  completionRate: 0.3,
  acceptanceRate: 0.3,
  costEfficiency: 0.2,
  escalationAccuracy: 0.2,
};
const HUMAN_WEIGHTS = { accuracy: 0.35, timeliness: 0.25, correction: 0.25, knowledge: 0.15 };

export class DualTrackEvaluator {
  static evaluateAgent(data: Omit<AgentScorecard, 'score'>): AgentScorecard {
    const costScore = data.avgTokenCost > 0 ? Math.max(0, 100 - data.avgTokenCost / 100) : 50;
    const score =
      data.completionRate * 100 * AGENT_WEIGHTS.completionRate +
      data.acceptanceRate * 100 * AGENT_WEIGHTS.acceptanceRate +
      costScore * AGENT_WEIGHTS.costEfficiency +
      data.escalationAccuracy * 100 * AGENT_WEIGHTS.escalationAccuracy;

    return { ...data, score: Math.round(score * 10) / 10 };
  }

  static evaluateHuman(data: Omit<HumanJudgmentScorecard, 'score'>): HumanJudgmentScorecard {
    const score =
      data.accuracyRate * 100 * HUMAN_WEIGHTS.accuracy +
      data.timelinessRate * 100 * HUMAN_WEIGHTS.timeliness +
      data.correctionEffectiveness * 100 * HUMAN_WEIGHTS.correction +
      data.knowledgeContribution * 100 * HUMAN_WEIGHTS.knowledge;

    return { ...data, score: Math.round(score * 10) / 10 };
  }

  static computeAdjustments(
    agents: readonly AgentScorecard[],
    humans: readonly HumanJudgmentScorecard[]
  ): EvaluationAdjustment[] {
    const adjustments: EvaluationAdjustment[] = [];

    for (const agent of agents) {
      if (agent.score >= 80) {
        adjustments.push({
          targetId: agent.agentId,
          targetType: 'agent',
          adjustment: 'promote',
          reason: `High performance score: ${agent.score}`,
          newWeight: 1.2,
        });
      } else if (agent.score < 40) {
        adjustments.push({
          targetId: agent.agentId,
          targetType: 'agent',
          adjustment: 'demote',
          reason: `Low performance score: ${agent.score}`,
          newWeight: 0.6,
        });
      } else {
        adjustments.push({
          targetId: agent.agentId,
          targetType: 'agent',
          adjustment: 'maintain',
          reason: `Adequate performance: ${agent.score}`,
          newWeight: 1.0,
        });
      }
    }

    for (const human of humans) {
      if (human.score >= 80) {
        adjustments.push({
          targetId: human.userId,
          targetType: 'human',
          adjustment: 'promote',
          reason: `High judgment quality: ${human.score}`,
          newWeight: 1.2,
        });
      } else if (human.score < 40) {
        adjustments.push({
          targetId: human.userId,
          targetType: 'human',
          adjustment: 'demote',
          reason: `Judgment quality needs improvement: ${human.score}`,
          newWeight: 0.7,
        });
      } else {
        adjustments.push({
          targetId: human.userId,
          targetType: 'human',
          adjustment: 'maintain',
          reason: `Adequate judgment quality: ${human.score}`,
          newWeight: 1.0,
        });
      }
    }

    return adjustments;
  }
}
