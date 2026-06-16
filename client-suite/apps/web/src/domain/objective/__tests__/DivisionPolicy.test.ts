import { describe, it, expect } from 'vitest';
import { DivisionPolicy } from '../DivisionPolicy';

describe('DivisionPolicy', () => {
  it('creates with default rules', () => {
    const policy = DivisionPolicy.createDefault();
    expect(policy.rules.length).toBeGreaterThan(0);
    expect(policy.defaultMode).toBe('auto');
  });

  it('evaluates transition on determinism drop', () => {
    const policy = DivisionPolicy.createDefault();
    const result = policy.evaluateTransition('auto', {
      determinism: 0.5,
      risk: 0.3,
      failureStreak: 0,
      confidence: 0.6,
    });
    expect(result).toBe('human-approve');
  });

  it('evaluates transition on failure streak', () => {
    const policy = DivisionPolicy.createDefault();
    const result = policy.evaluateTransition('auto', {
      determinism: 0.9,
      risk: 0.2,
      failureStreak: 3,
      confidence: 0.8,
    });
    expect(result).toBe('human-review');
  });

  it('stays in current mode when no condition met', () => {
    const policy = DivisionPolicy.createDefault();
    const result = policy.evaluateTransition('auto', {
      determinism: 0.95,
      risk: 0.1,
      failureStreak: 0,
      confidence: 0.5,
    });
    expect(result).toBe('auto');
  });

  it('adds and removes rules', () => {
    const policy = DivisionPolicy.createDefault();
    const withRule = policy.addRule({
      from: 'auto',
      to: 'human-lead',
      condition: { type: 'manual-override' },
      description: 'test',
    });
    expect(withRule.rules.length).toBe(policy.rules.length + 1);
    const withoutRule = withRule.removeRule('auto', 'human-lead');
    expect(withoutRule.rules.length).toBe(policy.rules.length);
  });

  it('getTransitionRulesFor filters by mode', () => {
    const policy = DivisionPolicy.createDefault();
    const autoRules = policy.getTransitionRulesFor('auto');
    expect(autoRules.every((r) => r.from === 'auto')).toBe(true);
  });
});
