import { describe, it, expect } from 'vitest';
import { AgentScorecard } from '../AgentScorecard';

describe('AgentScorecard', () => {
  const baseProps = {
    agentId: 'a1',
    agentName: 'Test Agent',
    periodStart: Date.now() - 86400_000,
    periodEnd: Date.now(),
    totalTasksCompleted: 40,
    totalTasksFailed: 10,
    totalTasksAccepted: 38,
    totalEscalations: 5,
    accurateEscalations: 4,
    totalTokenCost: 50000,
  };

  it('computes score and rates', () => {
    const card = AgentScorecard.compute(baseProps);
    expect(card.completionRate).toBe(0.8);
    expect(card.acceptanceRate).toBe(38 / 40);
    expect(card.totalTasks).toBe(50);
    expect(card.score).toBeGreaterThan(0);
  });

  it('promotes high performers', () => {
    const card = AgentScorecard.compute({
      ...baseProps,
      totalTasksFailed: 2,
      totalTasksCompleted: 48,
    });
    expect(card.isHighPerformer()).toBe(true);
    expect(card.adjustment).toBe('promote');
  });

  it('demotes underperformers', () => {
    const card = AgentScorecard.compute({
      ...baseProps,
      totalTasksCompleted: 5,
      totalTasksFailed: 45,
      totalTasksAccepted: 2,
      accurateEscalations: 1,
      totalTokenCost: 250000,
    });
    expect(card.isUnderperforming()).toBe(true);
    expect(card.adjustment).toBe('demote');
  });

  it('handles zero tasks gracefully', () => {
    const card = AgentScorecard.compute({
      ...baseProps,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
      totalTasksAccepted: 0,
      totalEscalations: 0,
      accurateEscalations: 0,
      totalTokenCost: 0,
    });
    expect(card.totalTasks).toBe(0);
    expect(card.completionRate).toBe(0);
  });
});
