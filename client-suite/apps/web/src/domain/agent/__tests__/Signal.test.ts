import { describe, it, expect } from 'vitest';
import { Signal } from '../Signal';

describe('Signal', () => {
  const baseProps = {
    id: 'sig-1',
    source: 'decision' as const,
    urgency: 'high' as const,
    status: 'active' as const,
    deadline: Date.now() + 3600_000,
    impactScope: 5,
    payload: {
      entityId: 'dr-123',
      entityType: 'DecisionRequest',
      title: 'API 延迟异常',
      detail: 'P99 升至 500ms',
    },
    agentId: 'ops-assistant',
    createdAt: Date.now(),
  };

  it('creates a signal with all fields', () => {
    const s = Signal.create(baseProps);
    expect(s.id).toBe('sig-1');
    expect(s.source).toBe('decision');
    expect(s.urgency).toBe('high');
    expect(s.status).toBe('active');
    expect(s.impactScope).toBe(5);
    expect(s.agentId).toBe('ops-assistant');
    expect(s.isActive).toBe(true);
    expect(s.isExpired).toBe(false);
  });

  it('defaults agentId to empty string', () => {
    const { agentId: _, ...propsNoAgent } = baseProps;
    const s = Signal.create(propsNoAgent);
    expect(s.agentId).toBe('');
  });

  it('acknowledge transitions to acknowledged', () => {
    const s = Signal.create(baseProps).acknowledge();
    expect(s.status).toBe('acknowledged');
    expect(s.isActive).toBe(false);
  });

  it('resolve transitions to resolved', () => {
    const s = Signal.create(baseProps).resolve();
    expect(s.status).toBe('resolved');
  });

  it('expire transitions to expired', () => {
    const s = Signal.create(baseProps).expire();
    expect(s.status).toBe('expired');
    expect(s.isExpired).toBe(true);
  });

  it('isExpired is true when deadline passed and still active', () => {
    const s = Signal.create({ ...baseProps, deadline: Date.now() - 1000 });
    expect(s.isExpired).toBe(true);
  });

  it('timeRemaining returns positive value for future deadline', () => {
    const s = Signal.create({ ...baseProps, deadline: Date.now() + 10_000 });
    expect(s.timeRemaining).toBeGreaterThan(0);
    expect(s.timeRemaining).toBeLessThanOrEqual(10_000);
  });

  it('timeRemaining returns 0 for past deadline', () => {
    const s = Signal.create({ ...baseProps, deadline: Date.now() - 1000 });
    expect(s.timeRemaining).toBe(0);
  });

  it('toProps round-trips correctly', () => {
    const s = Signal.create(baseProps);
    const props = s.toProps();
    const s2 = Signal.create(props);
    expect(s2.id).toBe(s.id);
    expect(s2.source).toBe(s.source);
    expect(s2.payload.title).toBe(s.payload.title);
  });
});
