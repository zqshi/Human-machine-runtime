import { describe, it, expect, vi, afterEach } from 'vitest';
import { SignalCorrelator } from '../SignalCorrelator';
import { Signal } from '../../agent/Signal';

function makeSignal(overrides: Partial<Parameters<typeof Signal.create>[0]> = {}): Signal {
  return Signal.create({
    id: `sig-${Math.random().toString(36).slice(2)}`,
    source: 'task-exception',
    urgency: 'normal',
    status: 'active',
    deadline: Date.now() + 60_000,
    impactScope: 3,
    payload: { entityId: 'e1', entityType: 'task', title: 'Test signal' },
    agentId: 'agent-1',
    createdAt: Date.now(),
    ...overrides,
  });
}

describe('SignalCorrelator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('groups signals by source when >= minGroupSize agents', () => {
    const correlator = new SignalCorrelator({ minGroupSize: 3 });
    const signals = [
      makeSignal({ agentId: 'a1' }),
      makeSignal({ agentId: 'a2' }),
      makeSignal({ agentId: 'a3' }),
    ];
    const groups = correlator.correlate(signals);
    const sourceGroup = groups.find((g) => g.pattern.includes('task-exception'));
    expect(sourceGroup).toBeDefined();
    expect(sourceGroup!.sourceAgents.length).toBe(3);
  });

  it('does not group when agents < minGroupSize', () => {
    const correlator = new SignalCorrelator({ minGroupSize: 3 });
    const signals = [makeSignal({ agentId: 'a1' }), makeSignal({ agentId: 'a2' })];
    const groups = correlator.correlate(signals);
    const sourceGroup = groups.find((g) => g.pattern.includes('task-exception'));
    expect(sourceGroup).toBeUndefined();
  });

  it('excludes non-active signals', () => {
    const correlator = new SignalCorrelator({ minGroupSize: 2 });
    const signals = [
      makeSignal({ agentId: 'a1', status: 'active' }),
      makeSignal({ agentId: 'a2', status: 'resolved' }),
      makeSignal({ agentId: 'a3', status: 'active' }),
    ];
    const groups = correlator.correlate(signals);
    const sourceGroup = groups.find((g) => g.pattern.includes('task-exception'));
    expect(sourceGroup?.sourceAgents.length ?? 0).toBe(2);
  });

  it('excludes signals outside time window', () => {
    const correlator = new SignalCorrelator({ windowMs: 60_000, minGroupSize: 2 });
    const signals = [
      makeSignal({ agentId: 'a1', createdAt: Date.now() }),
      makeSignal({ agentId: 'a2', createdAt: Date.now() - 120_000 }),
      makeSignal({ agentId: 'a3', createdAt: Date.now() }),
    ];
    const groups = correlator.correlate(signals);
    const sourceGroup = groups.find((g) => g.pattern.includes('task-exception'));
    expect(sourceGroup?.sourceAgents.length ?? 0).toBe(2);
  });

  it('correlates by keyword across agents', () => {
    const correlator = new SignalCorrelator({ minGroupSize: 3 });
    const signals = [
      makeSignal({
        agentId: 'a1',
        source: 'decision',
        payload: { entityId: 'e1', entityType: 'x', title: 'Database connection timeout' },
      }),
      makeSignal({
        agentId: 'a2',
        source: 'notification',
        payload: { entityId: 'e2', entityType: 'x', title: 'Database latency spike' },
      }),
      makeSignal({
        agentId: 'a3',
        source: 'goal-alert',
        payload: { entityId: 'e3', entityType: 'x', title: 'Database unavailable' },
      }),
    ];
    const groups = correlator.correlate(signals);
    const kwGroup = groups.find((g) => g.pattern.toLowerCase().includes('database'));
    expect(kwGroup).toBeDefined();
    expect(kwGroup!.sourceAgents.length).toBe(3);
  });

  it('computes severity as critical when any signal is critical', () => {
    const correlator = new SignalCorrelator({ minGroupSize: 3 });
    const signals = [
      makeSignal({ agentId: 'a1', urgency: 'normal' }),
      makeSignal({ agentId: 'a2', urgency: 'critical' }),
      makeSignal({ agentId: 'a3', urgency: 'low' }),
    ];
    const groups = correlator.correlate(signals);
    const sourceGroup = groups.find((g) => g.pattern.includes('task-exception'));
    expect(sourceGroup?.severity).toBe('critical');
  });

  it('computes severity as high when >= 3 high urgency signals', () => {
    const correlator = new SignalCorrelator({ minGroupSize: 3 });
    const signals = [
      makeSignal({ agentId: 'a1', urgency: 'high' }),
      makeSignal({ agentId: 'a2', urgency: 'high' }),
      makeSignal({ agentId: 'a3', urgency: 'high' }),
    ];
    const groups = correlator.correlate(signals);
    const sourceGroup = groups.find((g) => g.pattern.includes('task-exception'));
    expect(sourceGroup?.severity).toBe('high');
  });

  it('computes severity as medium for >= 5 signals without critical/high', () => {
    const correlator = new SignalCorrelator({ minGroupSize: 5 });
    const signals = Array.from({ length: 5 }, (_, i) =>
      makeSignal({ agentId: `a${i}`, urgency: 'normal' })
    );
    const groups = correlator.correlate(signals);
    const sourceGroup = groups.find((g) => g.pattern.includes('task-exception'));
    expect(sourceGroup?.severity).toBe('medium');
  });

  it('uses custom windowMs', () => {
    const correlator = new SignalCorrelator({ windowMs: 1000, minGroupSize: 2 });
    const signals = [
      makeSignal({ agentId: 'a1', createdAt: Date.now() }),
      makeSignal({ agentId: 'a2', createdAt: Date.now() - 5000 }),
    ];
    const groups = correlator.correlate(signals);
    const sourceGroup = groups.find((g) => g.pattern.includes('task-exception'));
    expect(sourceGroup).toBeUndefined();
  });

  it('returns empty for empty input', () => {
    const correlator = new SignalCorrelator();
    expect(correlator.correlate([])).toHaveLength(0);
  });
});
