import { describe, it, expect } from 'vitest';
import { DualTrackEvaluator } from '../DualTrackEvaluator';

describe('DualTrackEvaluator', () => {
  it('scores high-performing agent', () => {
    const card = DualTrackEvaluator.evaluateAgent({
      agentId: 'a1',
      name: 'Analyst',
      completionRate: 0.95,
      acceptanceRate: 0.9,
      avgTokenCost: 500,
      escalationAccuracy: 0.85,
      totalTasks: 50,
      period: '2026-Q1',
    });

    expect(card.score).toBeGreaterThan(70);
  });

  it('scores low-performing agent below threshold', () => {
    const card = DualTrackEvaluator.evaluateAgent({
      agentId: 'a2',
      name: 'Rookie',
      completionRate: 0.3,
      acceptanceRate: 0.4,
      avgTokenCost: 5000,
      escalationAccuracy: 0.2,
      totalTasks: 10,
      period: '2026-Q1',
    });

    expect(card.score).toBeLessThan(40);
  });

  it('scores human judgment quality', () => {
    const card = DualTrackEvaluator.evaluateHuman({
      userId: 'u1',
      name: '张经理',
      accuracyRate: 0.85,
      timelinessRate: 0.9,
      correctionEffectiveness: 0.8,
      knowledgeContribution: 0.7,
      totalJudgments: 30,
      period: '2026-Q1',
    });

    expect(card.score).toBeGreaterThan(70);
  });

  it('computes adjustments — promote high performers', () => {
    const agents = [
      DualTrackEvaluator.evaluateAgent({
        agentId: 'a1',
        name: 'Star',
        completionRate: 0.95,
        acceptanceRate: 0.92,
        avgTokenCost: 300,
        escalationAccuracy: 0.9,
        totalTasks: 100,
        period: 'Q1',
      }),
    ];
    const humans = [
      DualTrackEvaluator.evaluateHuman({
        userId: 'u1',
        name: 'Lead',
        accuracyRate: 0.9,
        timelinessRate: 0.95,
        correctionEffectiveness: 0.85,
        knowledgeContribution: 0.8,
        totalJudgments: 50,
        period: 'Q1',
      }),
    ];

    const adjustments = DualTrackEvaluator.computeAdjustments(agents, humans);
    expect(adjustments[0].adjustment).toBe('promote');
    expect(adjustments[0].newWeight).toBe(1.2);
    expect(adjustments[1].adjustment).toBe('promote');
  });

  it('demotes underperformers', () => {
    const agents = [
      DualTrackEvaluator.evaluateAgent({
        agentId: 'a-bad',
        name: 'Bad',
        completionRate: 0.1,
        acceptanceRate: 0.2,
        avgTokenCost: 10000,
        escalationAccuracy: 0.1,
        totalTasks: 5,
        period: 'Q1',
      }),
    ];

    const adjustments = DualTrackEvaluator.computeAdjustments(agents, []);
    expect(adjustments[0].adjustment).toBe('demote');
    expect(adjustments[0].newWeight).toBeLessThan(1);
  });
});
