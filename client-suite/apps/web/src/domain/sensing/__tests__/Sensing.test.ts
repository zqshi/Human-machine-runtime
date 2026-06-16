import { describe, it, expect } from 'vitest';
import { Signal } from '../../agent/Signal';
import { SignalCorrelator } from '../SignalCorrelator';
import { PatternDetector } from '../PatternDetector';
import { EmergentSignal } from '../EmergentSignal';

function makeSignal(id: string, source: string, agentId: string, createdAt?: number): Signal {
  return Signal.create({
    id,
    source: source as Signal['source'],
    urgency: 'high',
    status: 'active',
    deadline: Date.now() + 3_600_000,
    impactScope: 3,
    payload: { entityId: id, entityType: 'test', title: `Signal ${id} error` },
    agentId,
    createdAt: createdAt ?? Date.now(),
  });
}

describe('SignalCorrelator', () => {
  it('groups signals from multiple agents within window', () => {
    const signals = [
      makeSignal('s1', 'task-exception', 'agent-a'),
      makeSignal('s2', 'task-exception', 'agent-b'),
      makeSignal('s3', 'task-exception', 'agent-c'),
      makeSignal('s4', 'task-exception', 'agent-d'),
    ];

    const correlator = new SignalCorrelator({ windowMs: 300_000, minGroupSize: 3 });
    const groups = correlator.correlate(signals);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].sourceAgents.length).toBeGreaterThanOrEqual(3);
  });

  it('does not group signals below threshold', () => {
    const signals = [
      makeSignal('s1', 'task-exception', 'agent-a'),
      makeSignal('s2', 'task-exception', 'agent-b'),
    ];

    const correlator = new SignalCorrelator({ windowMs: 300_000, minGroupSize: 3 });
    const groups = correlator.correlate(signals);
    const sourceGroups = groups.filter((g) => g.pattern.includes('task-exception'));
    expect(sourceGroups).toHaveLength(0);
  });

  it('ignores old signals outside window', () => {
    const oldTime = Date.now() - 600_000;
    const signals = [
      makeSignal('s1', 'task-exception', 'agent-a', oldTime),
      makeSignal('s2', 'task-exception', 'agent-b', oldTime),
      makeSignal('s3', 'task-exception', 'agent-c', oldTime),
    ];

    const correlator = new SignalCorrelator({ windowMs: 300_000, minGroupSize: 3 });
    const groups = correlator.correlate(signals);
    expect(groups).toHaveLength(0);
  });
});

describe('PatternDetector', () => {
  it('detects cascade failure pattern', () => {
    const groups = [
      {
        id: 'corr-1',
        signalIds: ['s1', 's2', 's3', 's4'],
        pattern: 'Multiple agents reporting task-exception signals',
        sourceAgents: ['agent-a', 'agent-b', 'agent-c', 'agent-d'],
        severity: 'high' as const,
        detectedAt: Date.now(),
        windowMs: 300_000,
      },
    ];

    const detector = new PatternDetector();
    const patterns = detector.detect(groups);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].ruleName).toBe('级联失败');
    expect(patterns[0].severity).toBe('critical');
  });
});

describe('EmergentSignal', () => {
  it('transitions through lifecycle', () => {
    const signal = EmergentSignal.create({
      patternId: 'pat-1',
      correlatedSignalIds: ['s1', 's2', 's3'],
      pattern: 'Cascade failure',
      severity: 'critical',
      suggestedAction: 'Pause agents',
    });

    expect(signal.status).toBe('detected');
    expect(signal.isActive).toBe(true);
    expect(signal.correlatedCount).toBe(3);

    const acked = signal.acknowledge();
    expect(acked.status).toBe('acknowledged');
    expect(acked.isActive).toBe(true);

    const resolved = acked.resolve();
    expect(resolved.status).toBe('resolved');
    expect(resolved.isActive).toBe(false);
    expect(resolved.resolvedAt).toBeDefined();
  });

  it('can be dismissed', () => {
    const signal = EmergentSignal.create({
      patternId: 'pat-1',
      correlatedSignalIds: ['s1'],
      pattern: 'test',
      severity: 'low',
      suggestedAction: 'ignore',
    }).dismiss();

    expect(signal.status).toBe('dismissed');
    expect(signal.isActive).toBe(false);
  });
});
