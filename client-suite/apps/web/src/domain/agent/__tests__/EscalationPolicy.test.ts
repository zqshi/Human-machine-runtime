import { describe, it, expect } from 'vitest';
import { EscalationPolicy, type TaskState } from '../EscalationPolicy';
import { TaskContract, type EscalationCondition } from '../TaskContract';

function makeContract(
  conditions: EscalationCondition[],
  estimatedCostTokens = 10000
): TaskContract {
  return TaskContract.create({
    objective: 'test task',
    inputs: [],
    acceptanceCriteria: [],
    constraints: [],
    escalationConditions: conditions,
    estimatedCostTokens,
    estimatedDurationMs: 60000,
    publishedIntents: [],
  });
}

const normalState: TaskState = {
  status: 'running',
  failureCount: 0,
  elapsedMs: 5000,
  tokensCost: 100,
  confidence: 0.9,
  isBlocked: false,
};

describe('EscalationPolicy', () => {
  it('no escalation when no conditions triggered', () => {
    const contract = makeContract([{ trigger: 'timeout', threshold: 60000, action: 'retry' }]);
    const result = EscalationPolicy.evaluate(contract, normalState);
    expect(result.shouldEscalate).toBe(false);
    expect(result.triggeredConditions).toHaveLength(0);
    expect(result.suggestedChain).toBeNull();
  });

  it('triggers on timeout', () => {
    const contract = makeContract([{ trigger: 'timeout', threshold: 3000, action: 'retry' }]);
    const state = { ...normalState, elapsedMs: 5000 };
    const result = EscalationPolicy.evaluate(contract, state);
    expect(result.shouldEscalate).toBe(true);
    expect(result.triggeredConditions).toHaveLength(1);
    expect(result.triggeredConditions[0].trigger).toBe('timeout');
  });

  it('triggers on failure-count', () => {
    const contract = makeContract([
      { trigger: 'failure-count', threshold: 3, action: 'swap-agent' },
    ]);
    const state = { ...normalState, failureCount: 5 };
    const result = EscalationPolicy.evaluate(contract, state);
    expect(result.shouldEscalate).toBe(true);
    expect(result.triggeredConditions[0].trigger).toBe('failure-count');
  });

  it('triggers on confidence-drop', () => {
    const contract = makeContract([
      { trigger: 'confidence-drop', threshold: 0.5, action: 'escalate-human' },
    ]);
    const state = { ...normalState, confidence: 0.3 };
    const result = EscalationPolicy.evaluate(contract, state);
    expect(result.shouldEscalate).toBe(true);
  });

  it('triggers on cost-overrun', () => {
    const contract = makeContract(
      [{ trigger: 'cost-overrun', threshold: 1.5, action: 'degrade' }],
      10000
    );
    const state = { ...normalState, tokensCost: 20000 };
    const result = EscalationPolicy.evaluate(contract, state);
    expect(result.shouldEscalate).toBe(true);
  });

  it('triggers on dependency-blocked', () => {
    const contract = makeContract([
      { trigger: 'dependency-blocked', threshold: 0, action: 'escalate-human' },
    ]);
    const state = { ...normalState, isBlocked: true };
    const result = EscalationPolicy.evaluate(contract, state);
    expect(result.shouldEscalate).toBe(true);
  });

  it('builds escalation chain with stages', () => {
    const contract = makeContract([
      { trigger: 'timeout', threshold: 1000, action: 'retry' },
      { trigger: 'failure-count', threshold: 1, action: 'swap-agent' },
    ]);
    const state = { ...normalState, elapsedMs: 5000, failureCount: 3 };
    const result = EscalationPolicy.evaluate(contract, state);
    expect(result.suggestedChain).not.toBeNull();
    expect(result.suggestedChain!.stages.length).toBeGreaterThanOrEqual(2);
  });

  it('always includes escalate-human as final stage', () => {
    const contract = makeContract([{ trigger: 'timeout', threshold: 1000, action: 'retry' }]);
    const state = { ...normalState, elapsedMs: 5000 };
    const result = EscalationPolicy.evaluate(contract, state);
    const stages = result.suggestedChain!.stages;
    expect(stages[stages.length - 1].stage).toBe('escalate-human');
  });
});
