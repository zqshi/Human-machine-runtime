import { describe, it, expect } from 'vitest';
import { EscalationGate, type EscalationContext } from '../EscalationGate';

describe('EscalationGate', () => {
  const gate = new EscalationGate();

  const baseContext: EscalationContext = {
    intentType: 'request_simulation',
    agentId: 'agent-a',
    confidence: 0.95,
    riskLevel: 'low',
    historicalAccuracy: 0.9,
    impactScope: 2,
    isReversible: true,
  };

  it('allows auto for high confidence + low risk + reversible', () => {
    const decision = gate.evaluate(baseContext);
    expect(decision.level).toBe('auto');
    expect(decision.confidence).toBeGreaterThan(0.9);
  });

  it('requires human-lead for critical risk regardless of confidence', () => {
    const ctx: EscalationContext = { ...baseContext, riskLevel: 'critical' };
    const decision = gate.evaluate(ctx);
    expect(decision.level).toBe('human-lead');
  });

  it('downgrades to human-approve when confidence is moderate', () => {
    const ctx: EscalationContext = { ...baseContext, confidence: 0.8, riskLevel: 'medium' };
    const decision = gate.evaluate(ctx);
    expect(decision.level).toBe('human-approve');
  });

  it('downgrades to human-review when confidence is low', () => {
    const ctx: EscalationContext = { ...baseContext, confidence: 0.5, riskLevel: 'medium' };
    const decision = gate.evaluate(ctx);
    expect(decision.level).toBe('human-review');
  });

  it('downgrades to human-lead when confidence is very low', () => {
    const ctx: EscalationContext = { ...baseContext, confidence: 0.3, riskLevel: 'high' };
    const decision = gate.evaluate(ctx);
    expect(decision.level).toBe('human-lead');
  });

  it('penalizes low historical accuracy', () => {
    const ctx: EscalationContext = { ...baseContext, confidence: 0.92, historicalAccuracy: 0.5 };
    const decision = gate.evaluate(ctx);
    expect(decision.level).not.toBe('auto');
  });

  it('penalizes irreversible actions', () => {
    const ctx: EscalationContext = { ...baseContext, confidence: 0.91, isReversible: false };
    const decision = gate.evaluate(ctx);
    expect(decision.level).not.toBe('auto');
  });

  it('penalizes high impact scope', () => {
    const ctx: EscalationContext = { ...baseContext, confidence: 0.92, impactScope: 10 };
    const decision = gate.evaluate(ctx);
    expect(decision.level).not.toBe('auto');
  });

  it('shouldEscalate returns true when not auto', () => {
    const ctx: EscalationContext = { ...baseContext, confidence: 0.6, riskLevel: 'medium' };
    expect(gate.shouldEscalate(ctx)).toBe(true);
  });

  it('shouldEscalate returns false when auto', () => {
    expect(gate.shouldEscalate(baseContext)).toBe(false);
  });

  it('custom thresholds change behavior', () => {
    const strict = gate.withThresholds({ autoThreshold: 0.99 });
    const decision = strict.evaluate(baseContext);
    expect(decision.level).not.toBe('auto');
  });
});
