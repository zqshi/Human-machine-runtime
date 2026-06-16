import { describe, it, expect } from 'vitest';
import { TaskContract } from '../TaskContract';

describe('TaskContract', () => {
  const baseProps = {
    objective: 'Process data',
    inputs: ['source-a', 'source-b'],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        description: 'Output matches schema',
        verificationMethod: 'automated' as const,
      },
    ],
    constraints: [
      { type: 'time' as const, description: '1h max', value: 3_600_000 },
      { type: 'cost' as const, description: '1000 tokens max', value: 1000 },
    ],
    escalationConditions: [
      { trigger: 'timeout' as const, threshold: 3_600_000, action: 'retry' as const },
      { trigger: 'failure-count' as const, threshold: 3, action: 'escalate-human' as const },
    ],
    estimatedCostTokens: 500,
    estimatedDurationMs: 60_000,
    publishedIntents: ['data-processing'],
  };

  it('create generates id and createdAt', () => {
    const contract = TaskContract.create(baseProps);
    expect(contract.id).toMatch(/^tc-/);
    expect(contract.createdAt).toBeGreaterThan(0);
    expect(contract.objective).toBe('Process data');
  });

  it('fromProps preserves all fields', () => {
    const props = { ...baseProps, id: 'tc-fixed', createdAt: 12345 };
    const contract = TaskContract.fromProps(props);
    expect(contract.id).toBe('tc-fixed');
    expect(contract.createdAt).toBe(12345);
  });

  it('timeConstraint returns first time constraint', () => {
    const contract = TaskContract.create(baseProps);
    expect(contract.timeConstraint?.type).toBe('time');
  });

  it('costConstraint returns first cost constraint', () => {
    const contract = TaskContract.create(baseProps);
    expect(contract.costConstraint?.type).toBe('cost');
  });

  it('escalationForTimeout finds timeout condition', () => {
    const contract = TaskContract.create(baseProps);
    expect(contract.escalationForTimeout?.trigger).toBe('timeout');
  });

  it('escalationForFailure finds failure-count condition', () => {
    const contract = TaskContract.create(baseProps);
    expect(contract.escalationForFailure?.trigger).toBe('failure-count');
  });

  it('hasAcceptanceCriteria is true when criteria exist', () => {
    const contract = TaskContract.create(baseProps);
    expect(contract.hasAcceptanceCriteria()).toBe(true);
  });

  it('hasAcceptanceCriteria is false when empty', () => {
    const contract = TaskContract.create({ ...baseProps, acceptanceCriteria: [] });
    expect(contract.hasAcceptanceCriteria()).toBe(false);
  });

  it('canAutoVerify is true when all criteria are automated', () => {
    const contract = TaskContract.create(baseProps);
    expect(contract.canAutoVerify()).toBe(true);
  });

  it('canAutoVerify is false when human-review criteria exist', () => {
    const contract = TaskContract.create({
      ...baseProps,
      acceptanceCriteria: [
        { id: 'ac-1', description: 'Check quality', verificationMethod: 'human-review' },
      ],
    });
    expect(contract.canAutoVerify()).toBe(false);
  });
});
