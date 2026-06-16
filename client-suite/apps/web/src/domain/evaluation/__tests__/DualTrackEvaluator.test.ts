import { describe, it, expect } from 'vitest';
import { DualTrackEvaluator } from '../DualTrackEvaluator';
import type { AgentScorecard, HumanJudgmentScorecard } from '../DualTrackEvaluator';

describe('DualTrackEvaluator', () => {
  describe('evaluateAgent', () => {
    it('calculates weighted score', () => {
      const result = DualTrackEvaluator.evaluateAgent({
        agentId: 'a1',
        name: 'Agent 1',
        completionRate: 0.9,
        acceptanceRate: 0.8,
        avgTokenCost: 500,
        escalationAccuracy: 0.7,
        totalTasks: 100,
        period: '2026-Q1',
      });
      expect(result.score).toBeGreaterThan(0);
      expect(result.agentId).toBe('a1');
    });

    it('handles zero token cost', () => {
      const result = DualTrackEvaluator.evaluateAgent({
        agentId: 'a1',
        name: 'Agent 1',
        completionRate: 1.0,
        acceptanceRate: 1.0,
        avgTokenCost: 0,
        escalationAccuracy: 1.0,
        totalTasks: 50,
        period: '2026-Q1',
      });
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('evaluateHuman', () => {
    it('calculates weighted human score', () => {
      const result = DualTrackEvaluator.evaluateHuman({
        userId: 'u1',
        name: 'User 1',
        accuracyRate: 0.95,
        timelinessRate: 0.9,
        correctionEffectiveness: 0.85,
        knowledgeContribution: 0.7,
        totalJudgments: 200,
        period: '2026-Q1',
      });
      expect(result.score).toBeGreaterThan(0);
      expect(result.userId).toBe('u1');
    });
  });

  describe('computeAdjustments', () => {
    it('promotes high performers (score >= 80)', () => {
      const agents: AgentScorecard[] = [
        DualTrackEvaluator.evaluateAgent({
          agentId: 'a1',
          name: 'A',
          completionRate: 1,
          acceptanceRate: 1,
          avgTokenCost: 0,
          escalationAccuracy: 1,
          totalTasks: 100,
          period: 'Q1',
        }),
      ];
      const adjustments = DualTrackEvaluator.computeAdjustments(agents, []);
      expect(adjustments[0].adjustment).toBe('promote');
      expect(adjustments[0].newWeight).toBe(1.2);
    });

    it('demotes low performers (score < 40)', () => {
      const agents: AgentScorecard[] = [
        DualTrackEvaluator.evaluateAgent({
          agentId: 'a1',
          name: 'A',
          completionRate: 0.1,
          acceptanceRate: 0.1,
          avgTokenCost: 50000,
          escalationAccuracy: 0.1,
          totalTasks: 10,
          period: 'Q1',
        }),
      ];
      const adjustments = DualTrackEvaluator.computeAdjustments(agents, []);
      expect(adjustments[0].adjustment).toBe('demote');
      expect(adjustments[0].newWeight).toBe(0.6);
    });

    it('handles both agents and humans', () => {
      const agents: AgentScorecard[] = [
        {
          agentId: 'a1',
          name: 'A',
          completionRate: 0.5,
          acceptanceRate: 0.5,
          avgTokenCost: 500,
          escalationAccuracy: 0.5,
          totalTasks: 10,
          period: 'Q1',
          score: 50,
        },
      ];
      const humans: HumanJudgmentScorecard[] = [
        {
          userId: 'u1',
          name: 'U',
          accuracyRate: 0.9,
          timelinessRate: 0.9,
          correctionEffectiveness: 0.9,
          knowledgeContribution: 0.9,
          totalJudgments: 50,
          period: 'Q1',
          score: 90,
        },
      ];
      const adjustments = DualTrackEvaluator.computeAdjustments(agents, humans);
      expect(adjustments).toHaveLength(2);
      expect(adjustments.find((a) => a.targetType === 'agent')?.adjustment).toBe('maintain');
      expect(adjustments.find((a) => a.targetType === 'human')?.adjustment).toBe('promote');
    });
  });
});
