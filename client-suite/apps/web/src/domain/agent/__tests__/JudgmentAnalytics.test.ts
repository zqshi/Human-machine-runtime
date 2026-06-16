import { describe, it, expect } from 'vitest';
import { JudgmentAnalytics } from '../JudgmentAnalytics';
import { JudgmentRecord } from '../JudgmentRecord';
import { DecisionRequest } from '../DecisionRequest';

function makeRecord(
  overrides: { action?: string; duration?: number; source?: string; alternatives?: number } = {}
) {
  const createdAt = Date.now() - (overrides.duration ?? 300_000);
  const respondedAt = Date.now();

  const dr = DecisionRequest.create({
    id: `dr-${Math.random().toString(36).slice(2, 7)}`,
    agentId: 'agent-1',
    title: 'Test',
    context: 'ctx',
    recommendation: {
      id: 'r1',
      label: 'OK',
      description: '',
      reasoning: '',
      estimatedImpact: '',
      riskLevel: 'low',
    },
    alternatives: Array.from({ length: overrides.alternatives ?? 2 }, (_, i) => ({
      id: `alt-${i}`,
      label: `Alt ${i}`,
      description: '',
      reasoning: '',
      estimatedImpact: '',
      riskLevel: 'medium' as const,
    })),
    urgency: 'normal',
    deadline: Date.now() + 3600_000,
    responseStatus: (overrides.action ?? 'accepted') as 'accepted',
    responseAt: respondedAt,
    createdAt,
  });

  return JudgmentRecord.fromDecisionResponse(
    dr,
    (overrides.source ?? 'risk-rule-trigger') as 'risk-rule-trigger'
  );
}

describe('JudgmentAnalytics', () => {
  it('returns empty snapshot for empty input', () => {
    const snapshot = JudgmentAnalytics.compute([]);
    expect(snapshot.totalRecords).toBe(0);
    expect(snapshot.responseTime.mean).toBe(0);
    expect(snapshot.timeliness.onTimeRate).toBe(0);
  });

  it('computes correct action distribution', () => {
    const records = [
      makeRecord({ action: 'accepted' }),
      makeRecord({ action: 'accepted' }),
      makeRecord({ action: 'modified' }),
      makeRecord({ action: 'declined' }),
    ];

    const snapshot = JudgmentAnalytics.compute(records);
    expect(snapshot.totalRecords).toBe(4);
    expect(snapshot.actionDistribution.accepted).toBe(2);
    expect(snapshot.actionDistribution.modified).toBe(1);
    expect(snapshot.actionDistribution.declined).toBe(1);
    expect(snapshot.actionDistribution.deferred).toBe(0);
  });

  it('computes correct source distribution', () => {
    const records = [
      makeRecord({ source: 'risk-rule-trigger' }),
      makeRecord({ source: 'risk-rule-trigger' }),
      makeRecord({ source: 'milestone-arrival' }),
    ];

    const snapshot = JudgmentAnalytics.compute(records);
    expect(snapshot.sourceDistribution['risk-rule-trigger']).toBe(2);
    expect(snapshot.sourceDistribution['milestone-arrival']).toBe(1);
  });

  it('computes response time stats', () => {
    const records = [
      makeRecord({ duration: 60_000 }),
      makeRecord({ duration: 120_000 }),
      makeRecord({ duration: 300_000 }),
    ];

    const snapshot = JudgmentAnalytics.compute(records);
    expect(snapshot.responseTime.min).toBeLessThanOrEqual(snapshot.responseTime.median);
    expect(snapshot.responseTime.median).toBeLessThanOrEqual(snapshot.responseTime.max);
    expect(snapshot.responseTime.mean).toBeGreaterThan(0);
  });

  it('computes timeliness — all on time if within 1 hour', () => {
    const records = [makeRecord({ duration: 60_000 }), makeRecord({ duration: 300_000 })];

    const snapshot = JudgmentAnalytics.compute(records);
    expect(snapshot.timeliness.onTime).toBe(2);
    expect(snapshot.timeliness.onTimeRate).toBe(1);
  });

  it('marks late responses correctly', () => {
    const records = [makeRecord({ duration: 60_000 }), makeRecord({ duration: 4_000_000 })];

    const snapshot = JudgmentAnalytics.compute(records);
    expect(snapshot.timeliness.onTime).toBe(1);
    expect(snapshot.timeliness.late).toBe(1);
    expect(snapshot.timeliness.onTimeRate).toBe(0.5);
  });

  it('computes average alternative count', () => {
    const records = [makeRecord({ alternatives: 3 }), makeRecord({ alternatives: 5 })];

    const snapshot = JudgmentAnalytics.compute(records);
    expect(snapshot.averageAlternativeCount).toBe(4);
  });
});
