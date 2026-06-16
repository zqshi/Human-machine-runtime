import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfidenceCalculator } from '../ConfidenceCalculator';
import { StrategicObjective } from '../StrategicObjective';
import { JudgmentObjective } from '../JudgmentObjective';
import { ExecutionObjective } from '../ExecutionObjective';

function makeL0(overrides: Partial<Parameters<typeof StrategicObjective.fromProps>[0]> = {}) {
  return StrategicObjective.fromProps({
    id: 'l0-1',
    direction: 'test',
    description: 'test',
    coreConstraints: [],
    confidenceScore: 0,
    timeHorizon: 'annual',
    linkedL1Ids: ['l1-1', 'l1-2'],
    status: 'active',
    createdAt: Date.now() - 10_000,
    updatedAt: Date.now(),
    ...overrides,
  });
}

function makeL1(id: string, accuracyRate: number) {
  return JudgmentObjective.fromProps({
    id,
    l0Id: 'l0-1',
    keyQuestion: 'test?',
    description: 'test',
    cadence: 'weekly',
    linkedDecisionIds: [],
    accuracyRate,
    targetAccuracyRate: 0.8,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function makeL2(l1Id: string, completed: boolean) {
  return ExecutionObjective.fromProps({
    id: `l2-${Math.random()}`,
    l1Id,
    taskContractId: 'tc-1',
    linkedAgentId: 'agent-1',
    description: 'exec task',
    performanceMetrics: {
      completionRate: completed ? 1 : 0,
      acceptanceRate: 0,
      avgDurationMs: 0,
      tokensCost: 0,
    },
    status: completed ? 'completed' : 'in-progress',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

describe('ConfidenceCalculator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns zero breakdown when no linked L1s/L2s', () => {
    const l0 = makeL0({ linkedL1Ids: [] });
    const result = ConfidenceCalculator.computeForL0(l0, [], []);
    expect(result.completionScore).toBe(0);
    expect(result.accuracyScore).toBe(0);
    expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
  });

  it('full completion yields 100 completionScore', () => {
    const l0 = makeL0();
    const l1s = [makeL1('l1-1', 0.9), makeL1('l1-2', 0.8)];
    const l2s = [makeL2('l1-1', true), makeL2('l1-1', true), makeL2('l1-2', true)];
    const result = ConfidenceCalculator.computeForL0(l0, l1s, l2s);
    expect(result.completionScore).toBe(100);
  });

  it('partial completion computes correct ratio', () => {
    const l0 = makeL0();
    const l1s = [makeL1('l1-1', 0.7)];
    const l2s = [makeL2('l1-1', true), makeL2('l1-1', false)];
    const result = ConfidenceCalculator.computeForL0(l0, l1s, l2s);
    expect(result.completionScore).toBe(50);
  });

  it('accuracyScore averages L1 accuracy rates', () => {
    const l0 = makeL0();
    const l1s = [makeL1('l1-1', 0.6), makeL1('l1-2', 0.8)];
    const l2s = [makeL2('l1-1', true)];
    const result = ConfidenceCalculator.computeForL0(l0, l1s, l2s);
    expect(result.accuracyScore).toBe(70);
  });

  it('timelinessScore is 100 when ratio <= 0.3', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 1_000_000);
    const l0 = makeL0({ timeHorizon: 'annual', createdAt: 1_000_000_000 });
    const result = ConfidenceCalculator.computeForL0(l0, [], []);
    expect(result.timelinessScore).toBe(100);
  });

  it('timelinessScore decreases when ratio > 0.3', () => {
    const annualMs = 365 * 24 * 60 * 60 * 1000;
    const createdAt = Date.now() - annualMs * 0.5;
    const l0 = makeL0({ timeHorizon: 'annual', createdAt });
    const result = ConfidenceCalculator.computeForL0(l0, [], []);
    expect(result.timelinessScore).toBeLessThan(100);
    expect(result.timelinessScore).toBeGreaterThanOrEqual(0);
  });

  it('overallConfidence is weighted sum', () => {
    const l0 = makeL0();
    const l1s = [makeL1('l1-1', 1.0)];
    const l2s = [makeL2('l1-1', true)];
    const result = ConfidenceCalculator.computeForL0(l0, l1s, l2s);
    const expected =
      result.completionScore * 0.4 + result.accuracyScore * 0.35 + result.timelinessScore * 0.25;
    expect(result.overallConfidence).toBeCloseTo(expected, 5);
  });

  it('computeForL1 blends completion and accuracy equally', () => {
    const l1 = makeL1('l1-1', 0.8);
    const l2s = [makeL2('l1-1', true), makeL2('l1-1', false)];
    const confidence = ConfidenceCalculator.computeForL1(l1, l2s);
    expect(confidence).toBeCloseTo((50 * 0.5 + 80 * 0.5) / 100, 5);
  });

  it('computeForL1 returns 0 when no linked L2s', () => {
    const l1 = makeL1('l1-1', 0.5);
    const confidence = ConfidenceCalculator.computeForL1(l1, []);
    expect(confidence).toBeCloseTo((0 + 50 * 0.5) / 100, 5);
  });

  it('handles quarterly timeHorizon correctly', () => {
    const quarterMs = 90 * 24 * 60 * 60 * 1000;
    const createdAt = Date.now() - quarterMs * 0.1;
    const l0 = makeL0({ timeHorizon: 'quarterly', createdAt });
    const result = ConfidenceCalculator.computeForL0(l0, [], []);
    expect(result.timelinessScore).toBe(100);
  });
});
