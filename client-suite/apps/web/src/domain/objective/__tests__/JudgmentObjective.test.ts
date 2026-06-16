import { describe, it, expect } from 'vitest';
import { JudgmentObjective } from '../JudgmentObjective';

describe('JudgmentObjective', () => {
  it('create generates active with zero accuracy', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'Is growth on track?',
      description: 'Track growth',
      cadence: 'weekly',
    });
    expect(l1.id).toMatch(/^l1-/);
    expect(l1.status).toBe('active');
    expect(l1.accuracyRate).toBe(0);
    expect(l1.targetAccuracyRate).toBe(0.8);
    expect(l1.linkedDecisionIds).toHaveLength(0);
  });

  it('create accepts custom targetAccuracyRate', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'monthly',
      targetAccuracyRate: 0.95,
    });
    expect(l1.targetAccuracyRate).toBe(0.95);
  });

  it('fromProps preserves all fields', () => {
    const l1 = JudgmentObjective.fromProps({
      id: 'l1-1',
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'daily',
      linkedDecisionIds: ['d1', 'd2'],
      accuracyRate: 0.85,
      targetAccuracyRate: 0.8,
      status: 'active',
      createdAt: 1000,
      updatedAt: 2000,
    });
    expect(l1.linkedDecisionIds).toEqual(['d1', 'd2']);
    expect(l1.cadence).toBe('daily');
  });

  it('linkDecision adds decision id', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'weekly',
    });
    const linked = l1.linkDecision('d1').linkDecision('d2');
    expect(linked.linkedDecisionIds).toEqual(['d1', 'd2']);
  });

  it('linkDecision is idempotent', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'weekly',
    });
    const linked = l1.linkDecision('d1').linkDecision('d1');
    expect(linked.linkedDecisionIds).toEqual(['d1']);
  });

  it('updateAccuracy clamps to [0,1]', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'weekly',
    });
    expect(l1.updateAccuracy(1.5).accuracyRate).toBe(1);
    expect(l1.updateAccuracy(-0.2).accuracyRate).toBe(0);
    expect(l1.updateAccuracy(0.75).accuracyRate).toBe(0.75);
  });

  it('isOnTarget returns true when accuracy >= target', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'weekly',
    }).updateAccuracy(0.85);
    expect(l1.isOnTarget).toBe(true);
  });

  it('isOnTarget returns false when accuracy < target', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'weekly',
    }).updateAccuracy(0.5);
    expect(l1.isOnTarget).toBe(false);
  });

  it('gap calculates correctly', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'weekly',
    }).updateAccuracy(0.6);
    expect(l1.gap).toBeCloseTo(0.2, 5);
  });

  it('gap is zero when on target', () => {
    const l1 = JudgmentObjective.create({
      l0Id: 'l0-1',
      keyQuestion: 'q',
      description: 'd',
      cadence: 'weekly',
    }).updateAccuracy(0.9);
    expect(l1.gap).toBe(0);
  });
});
