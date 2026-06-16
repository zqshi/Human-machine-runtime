import { describe, it, expect } from 'vitest';
import { DecisionPattern, type PatternOutcome } from '../DecisionPattern';

function makePattern(overrides: Partial<Parameters<typeof DecisionPattern.fromProps>[0]> = {}) {
  return DecisionPattern.fromProps({
    id: 'dp-1',
    name: 'test pattern',
    description: 'test desc',
    contextFingerprint: {
      keywords: ['timeout', 'database'],
      urgency: 'high',
      source: 'task-exception',
      impactRange: [2, 8],
    },
    recommendedAction: 'restart service',
    outcomes: [],
    confidence: 0,
    usageCount: 0,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  });
}

const outcome1: PatternOutcome = {
  action: 'restart service',
  successRate: 0.9,
  avgResponseMs: 3000,
  sampleSize: 10,
};
const outcome2: PatternOutcome = {
  action: 'scale up',
  successRate: 0.7,
  avgResponseMs: 5000,
  sampleSize: 5,
};

describe('DecisionPattern', () => {
  it('create generates id and defaults', () => {
    const p = DecisionPattern.create({
      name: 'new',
      description: 'desc',
      contextFingerprint: {
        keywords: ['k1'],
        urgency: 'normal',
        source: 'decision',
        impactRange: [1, 3],
      },
      recommendedAction: 'do nothing',
      outcomes: [],
    });
    expect(p.id).toMatch(/^dp-/);
    expect(p.usageCount).toBe(0);
    expect(p.confidence).toBe(0);
  });

  it('fromProps round-trips', () => {
    const p = makePattern({ name: 'round-trip' });
    expect(p.name).toBe('round-trip');
    expect(p.contextFingerprint.keywords).toEqual(['timeout', 'database']);
  });

  it('recordUsage adds new outcome', () => {
    const p = makePattern();
    const updated = p.recordUsage(outcome1);
    expect(updated.outcomes).toHaveLength(1);
    expect(updated.usageCount).toBe(1);
    expect(updated.confidence).toBe(0.9);
    expect(updated.recommendedAction).toBe('restart service');
  });

  it('recordUsage merges existing outcome', () => {
    const p = makePattern().recordUsage(outcome1);
    const merged = p.recordUsage({
      action: 'restart service',
      successRate: 0.8,
      avgResponseMs: 2000,
      sampleSize: 10,
    });
    expect(merged.outcomes).toHaveLength(1);
    expect(merged.outcomes[0].sampleSize).toBe(20);
    expect(merged.outcomes[0].successRate).toBeCloseTo(0.85, 5);
    expect(merged.usageCount).toBe(2);
  });

  it('recordUsage updates recommendedAction to best outcome', () => {
    const p = makePattern().recordUsage(outcome2).recordUsage(outcome1);
    expect(p.recommendedAction).toBe('restart service');
    expect(p.confidence).toBe(0.9);
  });

  it('bestOutcome returns highest success rate', () => {
    const p = makePattern().recordUsage(outcome2).recordUsage(outcome1);
    expect(p.bestOutcome?.action).toBe('restart service');
  });

  it('bestOutcome returns undefined when no outcomes', () => {
    const p = makePattern();
    expect(p.bestOutcome).toBeUndefined();
  });

  it('recordUsage is immutable', () => {
    const original = makePattern();
    const updated = original.recordUsage(outcome1);
    expect(original.usageCount).toBe(0);
    expect(updated.usageCount).toBe(1);
  });
});
