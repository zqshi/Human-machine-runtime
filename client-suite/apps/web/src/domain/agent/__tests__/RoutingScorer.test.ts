import { describe, it, expect } from 'vitest';
import { RoutingScorer } from '../RoutingScorer';
import { AgentCapabilityProfile } from '../AgentCapabilityProfile';
import { TaskContract } from '../TaskContract';

function makeProfile(
  overrides: Partial<{
    agentId: string;
    domains: {
      domain: string;
      successRate: number;
      totalExecutions: number;
      avgDurationMs: number;
      avgTokenCost: number;
    }[];
    overallSuccessRate: number;
    totalTasksCompleted: number;
    totalTasksFailed: number;
    totalTokensConsumed: number;
  }> = {}
) {
  return AgentCapabilityProfile.fromProps({
    agentId: overrides.agentId ?? 'agent-01',
    name: 'Test Agent',
    domains: overrides.domains ?? [
      {
        domain: 'data-analysis',
        successRate: 0.9,
        totalExecutions: 30,
        avgDurationMs: 1000,
        avgTokenCost: 100,
      },
      {
        domain: 'reporting',
        successRate: 0.8,
        totalExecutions: 20,
        avgDurationMs: 800,
        avgTokenCost: 80,
      },
    ],
    overallSuccessRate: overrides.overallSuccessRate ?? 0.9,
    totalTasksCompleted: overrides.totalTasksCompleted ?? 45,
    totalTasksFailed: overrides.totalTasksFailed ?? 5,
    avgResponseMs: 1000,
    totalTokensConsumed: overrides.totalTokensConsumed ?? 5000,
    lastActiveAt: Date.now(),
    createdAt: Date.now(),
  });
}

function makeContract(
  overrides: Partial<{ publishedIntents: string[]; estimatedCostTokens: number }> = {}
) {
  return TaskContract.create({
    objective: 'Analyze data',
    inputs: ['dataset-a'],
    acceptanceCriteria: [],
    constraints: [],
    escalationConditions: [],
    estimatedCostTokens: overrides.estimatedCostTokens ?? 200,
    estimatedDurationMs: 60_000,
    publishedIntents: overrides.publishedIntents ?? ['data-analysis'],
  });
}

describe('RoutingScorer', () => {
  it('scoreAgent returns weighted total', () => {
    const score = RoutingScorer.scoreAgent(makeProfile(), makeContract());
    expect(score.agentId).toBe('agent-01');
    expect(score.totalScore).toBeGreaterThan(0);
    expect(score.totalScore).toBeLessThanOrEqual(100);
  });

  it('computeMatchScore returns 100 when all intents matched', () => {
    const score = RoutingScorer.computeMatchScore(makeProfile(), makeContract());
    expect(score).toBe(100);
  });

  it('computeMatchScore returns 0 when no intents matched', () => {
    const score = RoutingScorer.computeMatchScore(
      makeProfile({
        domains: [
          {
            domain: 'unrelated',
            successRate: 0.9,
            totalExecutions: 10,
            avgDurationMs: 500,
            avgTokenCost: 50,
          },
        ],
      }),
      makeContract()
    );
    expect(score).toBe(0);
  });

  it('computeMatchScore returns 50 when no intents specified', () => {
    const score = RoutingScorer.computeMatchScore(
      makeProfile(),
      makeContract({ publishedIntents: [] })
    );
    expect(score).toBe(50);
  });

  it('computePerformanceScore maps success rate to 0-100', () => {
    const score = RoutingScorer.computePerformanceScore(makeProfile(), makeContract());
    expect(score).toBe(90);
  });

  it('computePerformanceScore returns 50 for new agent', () => {
    const score = RoutingScorer.computePerformanceScore(
      makeProfile({ totalTasksCompleted: 0, totalTasksFailed: 0 }),
      makeContract()
    );
    expect(score).toBe(50);
  });

  it('computeCostScore returns 100 when costPerTask is 0', () => {
    const score = RoutingScorer.computeCostScore(
      makeProfile({ totalTokensConsumed: 0 }),
      makeContract()
    );
    expect(score).toBe(100);
  });

  it('rankAgents sorts by totalScore descending', () => {
    const profiles = [
      makeProfile({ agentId: 'low', overallSuccessRate: 0.3 }),
      makeProfile({ agentId: 'high', overallSuccessRate: 0.95 }),
    ];
    const ranked = RoutingScorer.rankAgents(profiles, makeContract());
    expect(ranked[0].agentId).toBe('high');
    expect(ranked[1].agentId).toBe('low');
  });
});
