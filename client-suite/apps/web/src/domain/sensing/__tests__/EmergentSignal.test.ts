import { describe, it, expect } from 'vitest';
import { EmergentSignal } from '../EmergentSignal';

describe('EmergentSignal', () => {
  const createSignal = () =>
    EmergentSignal.create({
      patternId: 'pat-1',
      correlatedSignalIds: ['sig-1', 'sig-2'],
      pattern: 'cascade-failure',
      severity: 'high',
      suggestedAction: 'Investigate service chain',
    });

  it('creates with detected status', () => {
    const s = createSignal();
    expect(s.status).toBe('detected');
    expect(s.id).toMatch(/^emg-/);
    expect(s.severity).toBe('high');
    expect(s.isActive).toBe(true);
    expect(s.correlatedCount).toBe(2);
  });

  it('acknowledge transitions to acknowledged', () => {
    const s = createSignal();
    const ack = s.acknowledge();
    expect(ack.status).toBe('acknowledged');
    expect(ack.isActive).toBe(true);
  });

  it('resolve transitions to resolved', () => {
    const s = createSignal();
    const resolved = s.resolve();
    expect(resolved.status).toBe('resolved');
    expect(resolved.isActive).toBe(false);
    expect(resolved.resolvedAt).toBeGreaterThan(0);
  });

  it('dismiss transitions to dismissed', () => {
    const s = createSignal();
    const dismissed = s.dismiss();
    expect(dismissed.status).toBe('dismissed');
    expect(dismissed.isActive).toBe(false);
    expect(dismissed.resolvedAt).toBeGreaterThan(0);
  });

  it('preserves fields across transitions', () => {
    const s = createSignal();
    const resolved = s.acknowledge().resolve();
    expect(resolved.patternId).toBe('pat-1');
    expect(resolved.pattern).toBe('cascade-failure');
    expect(resolved.suggestedAction).toBe('Investigate service chain');
    expect(resolved.correlatedSignalIds).toEqual(['sig-1', 'sig-2']);
  });

  it('is immutable — original unchanged', () => {
    const s = createSignal();
    s.acknowledge();
    expect(s.status).toBe('detected');
  });

  it('correlatedCount reflects signal ids length', () => {
    const s = EmergentSignal.create({
      patternId: 'p',
      correlatedSignalIds: ['a', 'b', 'c', 'd'],
      pattern: 'test',
      severity: 'low',
      suggestedAction: 'none',
    });
    expect(s.correlatedCount).toBe(4);
  });
});
