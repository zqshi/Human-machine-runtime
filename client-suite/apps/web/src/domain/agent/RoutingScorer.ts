/**
 * RoutingScorer — 路由评分算法
 *
 * 为动态路由引擎提供加权评分：
 * matchScore(能力匹配度) × performanceScore(历史成功率) × costScore(成本效率)
 */

import type { AgentCapabilityProfile } from './AgentCapabilityProfile';
import type { TaskContract } from './TaskContract';

export interface AgentScore {
  readonly agentId: string;
  readonly matchScore: number;
  readonly performanceScore: number;
  readonly costScore: number;
  readonly totalScore: number;
}

const W_MATCH = 0.4;
const W_PERF = 0.35;
const W_COST = 0.25;

export class RoutingScorer {
  static scoreAgent(profile: AgentCapabilityProfile, contract: TaskContract): AgentScore {
    const matchScore = RoutingScorer.computeMatchScore(profile, contract);
    const performanceScore = RoutingScorer.computePerformanceScore(profile, contract);
    const costScore = RoutingScorer.computeCostScore(profile, contract);

    return {
      agentId: profile.agentId,
      matchScore,
      performanceScore,
      costScore,
      totalScore: matchScore * W_MATCH + performanceScore * W_PERF + costScore * W_COST,
    };
  }

  static rankAgents(
    profiles: readonly AgentCapabilityProfile[],
    contract: TaskContract
  ): AgentScore[] {
    return profiles
      .map((p) => RoutingScorer.scoreAgent(p, contract))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  static computeMatchScore(profile: AgentCapabilityProfile, contract: TaskContract): number {
    const intentTypes = contract.publishedIntents;
    if (intentTypes.length === 0) return 50;

    const domains = profile.domains.map((d) => d.domain);
    const matched = intentTypes.filter((t) => domains.includes(t));
    return (matched.length / intentTypes.length) * 100;
  }

  static computePerformanceScore(profile: AgentCapabilityProfile, _contract: TaskContract): number {
    if (profile.totalTasks === 0) return 50;
    return profile.overallSuccessRate * 100;
  }

  static computeCostScore(profile: AgentCapabilityProfile, contract: TaskContract): number {
    if (profile.totalTasks === 0) return 50;
    const costPerTask = profile.costPerTask;
    if (costPerTask === 0) return 100;

    const estimatedCost = contract.estimatedCostTokens;
    if (estimatedCost === 0) return 50;

    const ratio = costPerTask / estimatedCost;
    if (ratio <= 0.5) return 100;
    if (ratio >= 2) return 0;
    return Math.round((1 - (ratio - 0.5) / 1.5) * 100);
  }
}
