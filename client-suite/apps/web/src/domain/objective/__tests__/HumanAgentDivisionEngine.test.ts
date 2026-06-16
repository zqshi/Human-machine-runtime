import { describe, it, expect } from 'vitest';
import { HumanAgentDivisionEngine, type DivisionContext } from '../HumanAgentDivisionEngine';

function makeCtx(overrides: Partial<DivisionContext> = {}): DivisionContext {
  return {
    determinism: 0.8,
    riskLevel: 0.3,
    historicalSuccessRate: 0.9,
    impactScope: 2,
    isReversible: true,
    dataCompleteness: 0.9,
    ...overrides,
  };
}

describe('HumanAgentDivisionEngine', () => {
  const engine = new HumanAgentDivisionEngine();

  it('auto mode: high determinism + low risk', () => {
    const result = engine.evaluate(makeCtx({ determinism: 0.9, riskLevel: 0.2 }));
    expect(result.mode).toBe('auto');
    expect(result.humanRole).toBe('无需介入');
  });

  it('human-approve mode: high determinism + high risk', () => {
    const result = engine.evaluate(makeCtx({ determinism: 0.9, riskLevel: 0.6 }));
    expect(result.mode).toBe('human-approve');
    expect(result.humanRole).toBe('审批确认');
  });

  it('human-review mode: low determinism + low risk', () => {
    const result = engine.evaluate(makeCtx({ determinism: 0.4, riskLevel: 0.2 }));
    expect(result.mode).toBe('human-review');
    expect(result.humanRole).toBe('选择方向');
  });

  it('human-lead mode: low determinism + high risk', () => {
    const result = engine.evaluate(makeCtx({ determinism: 0.4, riskLevel: 0.6 }));
    expect(result.mode).toBe('human-lead');
    expect(result.humanRole).toBe('主导决策');
  });

  it('low data completeness reduces effective determinism', () => {
    const highData = engine.evaluate(makeCtx({ determinism: 0.75, dataCompleteness: 0.9 }));
    const lowData = engine.evaluate(makeCtx({ determinism: 0.75, dataCompleteness: 0.3 }));
    expect(highData.mode).toBe('auto');
    expect(lowData.mode).not.toBe('auto');
  });

  it('low historical success rate reduces effective determinism', () => {
    const highRate = engine.evaluate(makeCtx({ determinism: 0.75, historicalSuccessRate: 0.95 }));
    const lowRate = engine.evaluate(makeCtx({ determinism: 0.75, historicalSuccessRate: 0.5 }));
    expect(highRate.mode).toBe('auto');
    expect(lowRate.mode).not.toBe('auto');
  });

  it('irreversible action increases effective risk', () => {
    const reversible = engine.evaluate(makeCtx({ riskLevel: 0.4, isReversible: true }));
    const irreversible = engine.evaluate(makeCtx({ riskLevel: 0.4, isReversible: false }));
    expect(reversible.mode).toBe('auto');
    expect(irreversible.mode).toBe('human-approve');
  });

  it('high impact scope increases effective risk', () => {
    const lowScope = engine.evaluate(makeCtx({ riskLevel: 0.35, impactScope: 2 }));
    const highScope = engine.evaluate(makeCtx({ riskLevel: 0.35, impactScope: 15 }));
    expect(lowScope.mode).toBe('auto');
    expect(highScope.mode).toBe('human-approve');
  });

  it('withPolicy creates new engine with merged policy', () => {
    const strict = engine.withPolicy({ determinismThreshold: 0.95 });
    const result = strict.evaluate(makeCtx({ determinism: 0.9, riskLevel: 0.2 }));
    expect(result.mode).toBe('human-review');
  });

  it('confidence reflects effective determinism', () => {
    const result = engine.evaluate(makeCtx({ determinism: 0.85 }));
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
