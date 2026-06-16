import { describe, it, expect } from 'vitest';
import { HypothesisValidator, type StrategicHypothesis } from '../HypothesisValidator';

function makeHypothesis(overrides?: Partial<StrategicHypothesis>): StrategicHypothesis {
  return {
    id: 'h1',
    l0ObjectiveId: 'l0-1',
    statement: 'test hypothesis',
    baselineValue: 50,
    targetValue: 100,
    currentValue: undefined,
    validationMethod: 'metric-based',
    status: 'untested',
    createdAt: Date.now(),
    lastValidatedAt: undefined,
    ...overrides,
  };
}

describe('HypothesisValidator', () => {
  it('confirms hypothesis when actual matches target', () => {
    const h = makeHypothesis();
    const { updatedHypothesis, deviation } = HypothesisValidator.validate(h, {
      currentValue: 98,
      sampleSize: 10,
    });
    expect(deviation).toBe('none');
    expect(updatedHypothesis.status).toBe('confirmed');
  });

  it('challenges hypothesis on moderate deviation', () => {
    const h = makeHypothesis();
    const { deviation } = HypothesisValidator.validate(h, { currentValue: 70, sampleSize: 10 });
    expect(deviation).toBe('moderate');
  });

  it('refutes hypothesis on severe deviation', () => {
    const h = makeHypothesis();
    const { updatedHypothesis, deviation } = HypothesisValidator.validate(h, {
      currentValue: 20,
      sampleSize: 10,
    });
    expect(deviation).toBe('severe');
    expect(updatedHypothesis.status).toBe('refuted');
  });

  it('batchValidate processes multiple hypotheses', () => {
    const dataMap = new Map([['h1', { currentValue: 95, sampleSize: 5 }]]);
    const results = HypothesisValidator.batchValidate([makeHypothesis()], dataMap);
    expect(results).toHaveLength(1);
    expect(results[0].deviation).toBe('none');
  });

  it('needsAttention returns true for challenged/refuted', () => {
    expect(HypothesisValidator.needsAttention(makeHypothesis({ status: 'challenged' }))).toBe(true);
    expect(HypothesisValidator.needsAttention(makeHypothesis({ status: 'confirmed' }))).toBe(false);
  });

  it('isStale detects old validations', () => {
    expect(HypothesisValidator.isStale(makeHypothesis())).toBe(true);
    expect(HypothesisValidator.isStale(makeHypothesis({ lastValidatedAt: Date.now() }))).toBe(
      false
    );
  });
});
