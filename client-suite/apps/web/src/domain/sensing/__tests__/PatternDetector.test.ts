import { describe, it, expect } from 'vitest';
import { PatternDetector, type DetectionRule } from '../PatternDetector';
import type { CorrelationGroup } from '../SignalCorrelator';

function makeGroup(overrides: Partial<CorrelationGroup> = {}): CorrelationGroup {
  return {
    id: 'corr-1',
    signalIds: ['s1', 's2', 's3'],
    pattern: 'Multiple agents reporting task-exception signals',
    sourceAgents: ['agent-1', 'agent-2', 'agent-3'],
    severity: 'medium',
    detectedAt: Date.now(),
    windowMs: 300_000,
    ...overrides,
  };
}

describe('PatternDetector', () => {
  it('detects cascade-failure pattern', () => {
    const detector = new PatternDetector();
    const group = makeGroup({ pattern: 'task-exception cluster' });
    const patterns = detector.detect([group]);
    expect(patterns.length).toBeGreaterThanOrEqual(1);
    const cascade = patterns.find((p) => p.ruleId === 'rule-cascade-failure');
    expect(cascade).toBeDefined();
    expect(cascade!.severity).toBe('critical');
    expect(cascade!.suggestedAction).toContain('暂停');
  });

  it('detects multi-agent-anomaly pattern', () => {
    const detector = new PatternDetector();
    const group = makeGroup({
      signalIds: ['s1', 's2', 's3', 's4'],
      sourceAgents: ['a1', 'a2', 'a3', 'a4'],
    });
    const patterns = detector.detect([group]);
    const anomaly = patterns.find((p) => p.ruleId === 'rule-multi-agent-anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly!.suggestedAction).toContain('管理员');
  });

  it('detects goal-alert-cluster pattern', () => {
    const detector = new PatternDetector();
    const group = makeGroup({
      signalIds: ['s1', 's2'],
      sourceAgents: ['a1', 'a2'],
      pattern: 'goal-alert related',
    });
    const patterns = detector.detect([group]);
    const goalAlert = patterns.find((p) => p.ruleId === 'rule-goal-alert-cluster');
    expect(goalAlert).toBeDefined();
    expect(goalAlert!.severity).toBe('high');
  });

  it('skips group if signal count below minSignals', () => {
    const detector = new PatternDetector();
    const group = makeGroup({ signalIds: ['s1'], sourceAgents: ['a1', 'a2', 'a3'] });
    const patterns = detector.detect([group]);
    expect(patterns).toHaveLength(0);
  });

  it('skips group if agent count below minAgents', () => {
    const detector = new PatternDetector();
    const group = makeGroup({ signalIds: ['s1', 's2', 's3'], sourceAgents: ['a1'] });
    const patterns = detector.detect([group]);
    expect(patterns).toHaveLength(0);
  });

  it('respects sourceFilter for matching', () => {
    const detector = new PatternDetector();
    const group = makeGroup({ pattern: 'unrelated pattern' });
    const patterns = detector.detect([group]);
    const cascade = patterns.find((p) => p.ruleId === 'rule-cascade-failure');
    expect(cascade).toBeUndefined();
  });

  it('uses severityOverride from rule when present', () => {
    const detector = new PatternDetector();
    const group = makeGroup({ severity: 'low', pattern: 'task-exception issue' });
    const patterns = detector.detect([group]);
    const cascade = patterns.find((p) => p.ruleId === 'rule-cascade-failure');
    expect(cascade?.severity).toBe('critical');
  });

  it('uses group severity when no override', () => {
    const customRule: DetectionRule = {
      id: 'rule-custom',
      name: 'custom',
      minSignals: 1,
      minAgents: 1,
    };
    const detector = new PatternDetector([customRule]);
    const group = makeGroup({ severity: 'high', signalIds: ['s1'], sourceAgents: ['a1'] });
    const patterns = detector.detect([group]);
    expect(patterns[0].severity).toBe('high');
  });

  it('addRule returns new detector with additional rule', () => {
    const detector = new PatternDetector([]);
    const rule: DetectionRule = { id: 'rule-new', name: 'new', minSignals: 1, minAgents: 1 };
    const extended = detector.addRule(rule);
    const group = makeGroup({ signalIds: ['s1'], sourceAgents: ['a1'] });
    expect(detector.detect([group])).toHaveLength(0);
    expect(extended.detect([group])).toHaveLength(1);
  });

  it('detects multiple patterns from one group', () => {
    const detector = new PatternDetector();
    const group = makeGroup({
      signalIds: ['s1', 's2', 's3'],
      sourceAgents: ['a1', 'a2', 'a3'],
      pattern: 'task-exception + goal-alert composite',
    });
    const patterns = detector.detect([group]);
    expect(patterns.length).toBeGreaterThanOrEqual(2);
  });
});
