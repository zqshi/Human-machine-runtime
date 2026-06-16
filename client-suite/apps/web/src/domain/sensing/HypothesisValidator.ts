/**
 * HypothesisValidator — 战略假设验证
 *
 * 对比 L0 初始假设 vs 实际执行数据，检测偏差。
 */

import type { DeviationDegree } from './DeviationReport';

export interface StrategicHypothesis {
  readonly id: string;
  readonly l0ObjectiveId: string;
  readonly statement: string;
  readonly baselineValue?: number;
  readonly targetValue?: number;
  readonly currentValue?: number;
  readonly validationMethod: 'metric-based' | 'milestone-based' | 'expert-review';
  readonly status: 'untested' | 'confirmed' | 'challenged' | 'refuted';
  readonly createdAt: number;
  readonly lastValidatedAt?: number;
}

export class HypothesisValidator {
  static validate(
    hypothesis: StrategicHypothesis,
    actualData: { currentValue: number; sampleSize: number }
  ): { updatedHypothesis: StrategicHypothesis; deviation: DeviationDegree } {
    const target = hypothesis.targetValue ?? 0;
    const baseline = hypothesis.baselineValue ?? 0;
    const range = Math.abs(target - baseline) || 1;
    const deviationRatio = Math.abs(actualData.currentValue - target) / range;

    let degree: DeviationDegree;
    let status: StrategicHypothesis['status'];

    if (deviationRatio <= 0.1) {
      degree = 'none';
      status = 'confirmed';
    } else if (deviationRatio <= 0.3) {
      degree = 'minor';
      status = 'confirmed';
    } else if (deviationRatio <= 0.6) {
      degree = 'moderate';
      status = 'challenged';
    } else {
      degree = 'severe';
      status = 'refuted';
    }

    return {
      updatedHypothesis: {
        ...hypothesis,
        currentValue: actualData.currentValue,
        status,
        lastValidatedAt: Date.now(),
      },
      deviation: degree,
    };
  }

  static batchValidate(
    hypotheses: readonly StrategicHypothesis[],
    dataMap: ReadonlyMap<string, { currentValue: number; sampleSize: number }>
  ): Array<{
    hypothesisId: string;
    deviation: DeviationDegree;
    status: StrategicHypothesis['status'];
  }> {
    const results: Array<{
      hypothesisId: string;
      deviation: DeviationDegree;
      status: StrategicHypothesis['status'];
    }> = [];

    for (const h of hypotheses) {
      const data = dataMap.get(h.id);
      if (!data) continue;
      const { updatedHypothesis, deviation } = HypothesisValidator.validate(h, data);
      results.push({ hypothesisId: h.id, deviation, status: updatedHypothesis.status });
    }

    return results;
  }

  static needsAttention(hypothesis: StrategicHypothesis): boolean {
    return hypothesis.status === 'challenged' || hypothesis.status === 'refuted';
  }

  static isStale(hypothesis: StrategicHypothesis, maxAgeMs: number = 7 * 24 * 3600_000): boolean {
    if (!hypothesis.lastValidatedAt) return true;
    return Date.now() - hypothesis.lastValidatedAt > maxAgeMs;
  }
}
