import { describe, it, expect } from 'vitest';
import { TaskContract } from '../TaskContract';
import { AgentCapabilityProfile } from '../AgentCapabilityProfile';
import { RoutingScorer } from '../RoutingScorer';
import { EscalationChain } from '../EscalationChain';
import { EscalationPolicy, type TaskState } from '../EscalationPolicy';

describe('TaskContract', () => {
  it('creates with all fields', () => {
    const contract = TaskContract.create({
      objective: 'Analyze customer feedback',
      inputs: ['feedbackData'],
      acceptanceCriteria: [
        {
          id: 'ac-1',
          description: 'Accuracy > 90%',
          verificationMethod: 'metric-threshold',
          threshold: 0.9,
        },
      ],
      constraints: [{ type: 'time', description: 'Within 5 min', value: 300_000 }],
      escalationConditions: [{ trigger: 'timeout', threshold: 300_000, action: 'retry' }],
      estimatedCostTokens: 5000,
      estimatedDurationMs: 120_000,
      publishedIntents: ['analyze_feedback'],
    });

    expect(contract.objective).toBe('Analyze customer feedback');
    expect(contract.acceptanceCriteria).toHaveLength(1);
    expect(contract.canAutoVerify()).toBe(true);
    expect(contract.timeConstraint?.value).toBe(300_000);
    expect(contract.escalationForTimeout?.action).toBe('retry');
  });
});

describe('AgentCapabilityProfile', () => {
  it('records success and updates stats', () => {
    const profile = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Analyst' });
    const updated = profile.recordSuccess('analysis', 1000, 500);

    expect(updated.totalTasksCompleted).toBe(1);
    expect(updated.overallSuccessRate).toBe(1);
    expect(updated.avgResponseMs).toBe(1000);
    expect(updated.getDomain('analysis')?.successRate).toBe(1);
  });

  it('records failure and adjusts success rate', () => {
    const profile = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Analyst' })
      .recordSuccess('analysis', 1000, 500)
      .recordFailure('analysis', 2000, 800);

    expect(profile.totalTasks).toBe(2);
    expect(profile.overallSuccessRate).toBe(0.5);
    expect(profile.getDomain('analysis')?.successRate).toBe(0.5);
  });

  it('tracks multiple domains independently', () => {
    const profile = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Multi' })
      .recordSuccess('coding', 500, 200)
      .recordSuccess('writing', 1000, 400)
      .recordFailure('coding', 600, 300);

    expect(profile.getDomain('coding')?.successRate).toBe(0.5);
    expect(profile.getDomain('writing')?.successRate).toBe(1);
  });
});

describe('RoutingScorer', () => {
  it('ranks agents by composite score', () => {
    const contract = TaskContract.create({
      objective: 'test',
      inputs: [],
      acceptanceCriteria: [],
      constraints: [],
      escalationConditions: [],
      estimatedCostTokens: 1000,
      estimatedDurationMs: 60_000,
      publishedIntents: ['coding'],
    });

    const agentA = AgentCapabilityProfile.create({
      agentId: 'a',
      name: 'A',
      domains: [
        {
          domain: 'coding',
          successRate: 0.95,
          totalExecutions: 50,
          avgDurationMs: 500,
          avgTokenCost: 800,
        },
      ],
    }).recordSuccess('coding', 500, 800);

    const agentB = AgentCapabilityProfile.create({
      agentId: 'b',
      name: 'B',
      domains: [
        {
          domain: 'writing',
          successRate: 0.7,
          totalExecutions: 10,
          avgDurationMs: 2000,
          avgTokenCost: 1500,
        },
      ],
    }).recordSuccess('writing', 2000, 1500);

    const scores = RoutingScorer.rankAgents([agentA, agentB], contract);
    expect(scores[0].agentId).toBe('a');
    expect(scores[0].totalScore).toBeGreaterThan(scores[1].totalScore);
  });
});

describe('EscalationChain', () => {
  it('progresses through stages on failure', () => {
    let chain = EscalationChain.createDefault('task-1').trigger();
    expect(chain.currentStage?.stage).toBe('retry');

    chain = chain.recordAttempt(false, 'timeout');
    expect(chain.currentStage?.stage).toBe('retry');
    expect(chain.currentAttempt).toBe(1);

    chain = chain.recordAttempt(false, 'timeout');
    chain = chain.recordAttempt(false, 'timeout');
    expect(chain.currentStage?.stage).toBe('degrade');
  });

  it('resolves on success at any stage', () => {
    const chain = EscalationChain.createDefault('task-1').trigger().recordAttempt(true);

    expect(chain.isResolved).toBe(true);
    expect(chain.resolution).toContain('retry');
  });

  it('escalates to human when all stages exhausted', () => {
    let chain = EscalationChain.create('task-1', [
      { stage: 'retry', maxAttempts: 1, timeoutMs: 1000 },
      { stage: 'escalate-human', maxAttempts: 1, timeoutMs: 1000 },
    ]).trigger();

    chain = chain.recordAttempt(false);
    chain = chain.recordAttempt(false);
    expect(chain.isEscalatedToHuman).toBe(true);
  });
});

describe('EscalationPolicy', () => {
  it('triggers escalation on timeout', () => {
    const contract = TaskContract.create({
      objective: 'test',
      inputs: [],
      acceptanceCriteria: [],
      constraints: [],
      escalationConditions: [{ trigger: 'timeout', threshold: 30_000, action: 'retry' }],
      estimatedCostTokens: 1000,
      estimatedDurationMs: 30_000,
      publishedIntents: [],
    });

    const state: TaskState = {
      status: 'running',
      failureCount: 0,
      elapsedMs: 35_000,
      tokensCost: 500,
      confidence: 0.9,
      isBlocked: false,
    };

    const result = EscalationPolicy.evaluate(contract, state);
    expect(result.shouldEscalate).toBe(true);
    expect(result.triggeredConditions).toHaveLength(1);
    expect(result.suggestedChain).not.toBeNull();
  });

  it('does not escalate when within bounds', () => {
    const contract = TaskContract.create({
      objective: 'test',
      inputs: [],
      acceptanceCriteria: [],
      constraints: [],
      escalationConditions: [{ trigger: 'timeout', threshold: 30_000, action: 'retry' }],
      estimatedCostTokens: 1000,
      estimatedDurationMs: 30_000,
      publishedIntents: [],
    });

    const state: TaskState = {
      status: 'running',
      failureCount: 0,
      elapsedMs: 10_000,
      tokensCost: 200,
      confidence: 0.9,
      isBlocked: false,
    };

    const result = EscalationPolicy.evaluate(contract, state);
    expect(result.shouldEscalate).toBe(false);
  });
});
