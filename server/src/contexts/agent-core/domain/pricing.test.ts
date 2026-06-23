import { describe, it, expect } from 'vitest';
import { MODEL_PRICING_USD_PER_M, estimateCostUsd } from './pricing.js';

describe('MODEL_PRICING_USD_PER_M', () => {
  it('包含 claude-opus-4-6 / sonnet-4-6 / haiku-4-5 三个主力模型', () => {
    expect(MODEL_PRICING_USD_PER_M['claude-opus-4-6']).toBeDefined();
    expect(MODEL_PRICING_USD_PER_M['claude-sonnet-4-6']).toBeDefined();
    expect(MODEL_PRICING_USD_PER_M['claude-haiku-4-5']).toBeDefined();
  });

  it('opus 单价高于 sonnet,sonnet 高于 haiku', () => {
    const o = MODEL_PRICING_USD_PER_M['claude-opus-4-6']!;
    const s = MODEL_PRICING_USD_PER_M['claude-sonnet-4-6']!;
    const h = MODEL_PRICING_USD_PER_M['claude-haiku-4-5']!;
    expect(o.input).toBeGreaterThan(s.input);
    expect(s.input).toBeGreaterThan(h.input);
    expect(o.output).toBeGreaterThan(s.output);
    expect(s.output).toBeGreaterThan(h.output);
  });
});

describe('estimateCostUsd', () => {
  it('1M input + 0 output 恰好为单价 input', () => {
    const cost = estimateCostUsd('claude-sonnet-4-6', 1_000_000, 0);
    expect(cost).toBeCloseTo(3, 5);
  });

  it('0 input + 1M output 恰好为单价 output', () => {
    const cost = estimateCostUsd('claude-sonnet-4-6', 0, 1_000_000);
    expect(cost).toBeCloseTo(15, 5);
  });

  it('混合 token 按比例累加', () => {
    // 100k input × $3/M + 50k output × $15/M = 0.3 + 0.75 = 1.05
    const cost = estimateCostUsd('claude-sonnet-4-6', 100_000, 50_000);
    expect(cost).toBeCloseTo(1.05, 5);
  });

  it('opus 模型贵 5 倍', () => {
    const sonnetCost = estimateCostUsd('claude-sonnet-4-6', 100_000, 50_000);
    const opusCost = estimateCostUsd('claude-opus-4-6', 100_000, 50_000);
    // input: 15 vs 3 → 5x;output: 75 vs 15 → 5x;整体 5x
    expect(opusCost / sonnetCost).toBeCloseTo(5, 2);
  });

  it('未知 model 按 fallback(sonnet)单价估算', () => {
    const known = estimateCostUsd('claude-sonnet-4-6', 100_000, 50_000);
    const unknown = estimateCostUsd('some-future-model', 100_000, 50_000);
    expect(unknown).toBeCloseTo(known, 5);
  });

  it('model undefined 也走 fallback', () => {
    const cost = estimateCostUsd(undefined, 100_000, 50_000);
    expect(cost).toBeCloseTo(1.05, 5);
  });

  it('0 token 时成本为 0', () => {
    expect(estimateCostUsd('claude-sonnet-4-6', 0, 0)).toBe(0);
  });
});
