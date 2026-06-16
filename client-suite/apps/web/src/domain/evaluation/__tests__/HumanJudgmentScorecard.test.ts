import { describe, it, expect } from 'vitest';
import { HumanJudgmentScorecard } from '../HumanJudgmentScorecard';

describe('HumanJudgmentScorecard', () => {
  const baseProps = {
    userId: 'u1',
    userName: '张经理',
    periodStart: Date.now() - 86400_000,
    periodEnd: Date.now(),
    totalDecisions: 50,
    correctDecisions: 42,
    timelyDecisions: 40,
    avgResponseMs: 5000,
    correctionsApplied: 10,
    effectiveCorrections: 8,
    patternsContributed: 3,
  };

  it('computes score and rates', () => {
    const card = HumanJudgmentScorecard.compute(baseProps);
    expect(card.accuracyRate).toBeCloseTo(0.84, 2);
    expect(card.timelinessRate).toBeCloseTo(0.8, 2);
    expect(card.correctionEffectiveness).toBeCloseTo(0.8, 2);
    expect(card.score).toBeGreaterThan(0);
  });

  it('promotes high performers', () => {
    const card = HumanJudgmentScorecard.compute({
      ...baseProps,
      correctDecisions: 48,
      timelyDecisions: 48,
      effectiveCorrections: 10,
      patternsContributed: 5,
    });
    expect(card.isHighPerformer()).toBe(true);
    expect(card.adjustment).toBe('promote');
  });

  it('demotes underperformers', () => {
    const card = HumanJudgmentScorecard.compute({
      ...baseProps,
      correctDecisions: 5,
      timelyDecisions: 5,
      effectiveCorrections: 1,
      patternsContributed: 0,
    });
    expect(card.isUnderperforming()).toBe(true);
    expect(card.adjustment).toBe('demote');
  });

  it('handles zero decisions', () => {
    const card = HumanJudgmentScorecard.compute({
      ...baseProps,
      totalDecisions: 0,
      correctDecisions: 0,
      timelyDecisions: 0,
      correctionsApplied: 0,
      effectiveCorrections: 0,
      patternsContributed: 0,
    });
    expect(card.accuracyRate).toBe(0);
    expect(card.timelinessRate).toBe(0);
  });

  it('caps knowledge contribution at 1', () => {
    const card = HumanJudgmentScorecard.compute({ ...baseProps, patternsContributed: 20 });
    expect(card.knowledgeContribution).toBe(1);
  });
});
