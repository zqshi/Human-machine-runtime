import { describe, it, expect } from 'vitest';
import { SignalPrioritizer } from '../SignalPrioritizer';
import { DecisionRequest } from '../DecisionRequest';
import { Signal } from '../Signal';

const BASE_TIME = 1_700_000_000_000;

function makeDecision(overrides: Partial<Parameters<typeof DecisionRequest.create>[0]> = {}) {
  return DecisionRequest.create({
    id: `dr-${Math.random().toString(36).slice(2, 7)}`,
    agentId: 'agent-1',
    title: 'Test Decision',
    context: 'Test Context',
    recommendation: {
      id: 'opt-1',
      label: 'Default',
      description: 'Default option',
      reasoning: 'Default reasoning',
      estimatedImpact: 'Low',
      riskLevel: 'low',
    },
    alternatives: [],
    urgency: 'normal',
    deadline: BASE_TIME + 3600_000,
    responseStatus: 'pending',
    createdAt: BASE_TIME - 60_000,
    ...overrides,
  });
}

describe('SignalPrioritizer', () => {
  it('sorts critical before high before normal before low', () => {
    const decisions = [
      makeDecision({ id: 'low', urgency: 'low' }),
      makeDecision({ id: 'critical', urgency: 'critical' }),
      makeDecision({ id: 'normal', urgency: 'normal' }),
      makeDecision({ id: 'high', urgency: 'high' }),
    ];

    const sorted = SignalPrioritizer.prioritize(decisions, BASE_TIME);

    expect(sorted.map((d) => d.id)).toEqual(['critical', 'high', 'normal', 'low']);
  });

  it('sorts closer deadline higher within same urgency', () => {
    const soon = makeDecision({
      id: 'soon',
      urgency: 'high',
      deadline: BASE_TIME + 600_000,
    });
    const later = makeDecision({
      id: 'later',
      urgency: 'high',
      deadline: BASE_TIME + 7200_000,
    });

    const sorted = SignalPrioritizer.prioritize([later, soon], BASE_TIME);

    expect(sorted[0].id).toBe('soon');
  });

  it('sorts higher impactScope higher within same urgency and deadline', () => {
    const bigImpact = makeDecision({
      id: 'big',
      urgency: 'normal',
      deadline: BASE_TIME + 3600_000,
      impactScope: 10,
    });
    const smallImpact = makeDecision({
      id: 'small',
      urgency: 'normal',
      deadline: BASE_TIME + 3600_000,
      impactScope: 2,
    });

    const sorted = SignalPrioritizer.prioritize([smallImpact, bigImpact], BASE_TIME);

    expect(sorted[0].id).toBe('big');
  });

  it('returns empty array for empty input', () => {
    expect(SignalPrioritizer.prioritize([], BASE_TIME)).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const decisions = [
      makeDecision({ id: 'low', urgency: 'low' }),
      makeDecision({ id: 'critical', urgency: 'critical' }),
    ];
    const original = [...decisions];

    SignalPrioritizer.prioritize(decisions, BASE_TIME);

    expect(decisions.map((d) => d.id)).toEqual(original.map((d) => d.id));
  });

  it('calculates correct score for a critical decision', () => {
    const decision = makeDecision({
      urgency: 'critical',
      deadline: BASE_TIME + 300_000,
      impactScope: 5,
    });

    const score = SignalPrioritizer.computeScore(decision, BASE_TIME);

    expect(score).toBeGreaterThan(0);
  });

  it('handles decisions with default impactScope of 0', () => {
    const decision = makeDecision({ urgency: 'normal' });

    const score = SignalPrioritizer.computeScore(decision, BASE_TIME);

    expect(score).toBeGreaterThan(0);
  });

  it('handles expired deadlines gracefully', () => {
    const expired = makeDecision({
      urgency: 'high',
      deadline: BASE_TIME - 1000,
    });

    const score = SignalPrioritizer.computeScore(expired, BASE_TIME);

    expect(score).toBeGreaterThan(0);
  });

  describe('prioritizeSignals', () => {
    function makeSignal(overrides: Partial<Parameters<typeof Signal.create>[0]> = {}) {
      return Signal.create({
        id: `sig-${Math.random().toString(36).slice(2, 7)}`,
        source: 'decision',
        urgency: 'normal',
        status: 'active',
        deadline: BASE_TIME + 3600_000,
        impactScope: 1,
        payload: { entityId: 'e1', entityType: 'Test', title: 'Test' },
        agentId: 'agent-1',
        createdAt: BASE_TIME - 60_000,
        ...overrides,
      });
    }

    it('sorts critical signals before lower urgency', () => {
      const signals = [
        makeSignal({ id: 'low', urgency: 'low' }),
        makeSignal({ id: 'critical', urgency: 'critical' }),
        makeSignal({ id: 'high', urgency: 'high' }),
      ];

      const sorted = SignalPrioritizer.prioritizeSignals(signals, BASE_TIME);
      expect(sorted[0].id).toBe('critical');
      expect(sorted[1].id).toBe('high');
      expect(sorted[2].id).toBe('low');
    });

    it('filters out non-active signals', () => {
      const signals = [
        makeSignal({ id: 'active', status: 'active' }),
        makeSignal({ id: 'resolved', status: 'resolved' }),
        makeSignal({ id: 'acknowledged', status: 'acknowledged' }),
      ];

      const sorted = SignalPrioritizer.prioritizeSignals(signals, BASE_TIME);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('active');
    });

    it('applies time decay — older signals score lower', () => {
      const fresh = makeSignal({ id: 'fresh', urgency: 'high', createdAt: BASE_TIME - 60_000 });
      const old = makeSignal({ id: 'old', urgency: 'high', createdAt: BASE_TIME - 8 * 3600_000 });

      const freshScore = SignalPrioritizer.computeSignalScore(fresh, BASE_TIME);
      const oldScore = SignalPrioritizer.computeSignalScore(old, BASE_TIME);

      expect(freshScore).toBeGreaterThan(oldScore);
    });

    it('returns empty for empty input', () => {
      expect(SignalPrioritizer.prioritizeSignals([])).toEqual([]);
    });
  });
});
