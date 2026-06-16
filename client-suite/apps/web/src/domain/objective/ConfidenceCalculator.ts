/**
 * ConfidenceCalculator — 置信度计算
 *
 * 替代简单的"进度百分比"，基于：
 * - L2 完成率 (40%)
 * - L1 判断准确率 (35%)
 * - 时间进度匹配度 (25%)
 */

import type { StrategicObjective } from './StrategicObjective';
import type { JudgmentObjective } from './JudgmentObjective';
import type { ExecutionObjective } from './ExecutionObjective';

const W_COMPLETION = 0.4;
const W_ACCURACY = 0.35;
const W_TIMELINESS = 0.25;

export interface ConfidenceBreakdown {
  readonly completionScore: number;
  readonly accuracyScore: number;
  readonly timelinessScore: number;
  readonly overallConfidence: number;
}

export class ConfidenceCalculator {
  static computeForL0(
    l0: StrategicObjective,
    l1s: readonly JudgmentObjective[],
    l2s: readonly ExecutionObjective[]
  ): ConfidenceBreakdown {
    const linkedL1s = l1s.filter((l1) => l0.linkedL1Ids.includes(l1.id));
    const linkedL2s = l2s.filter((l2) => linkedL1s.some((l1) => l1.id === l2.l1Id));

    const completionScore = ConfidenceCalculator.computeCompletionScore(linkedL2s);
    const accuracyScore = ConfidenceCalculator.computeAccuracyScore(linkedL1s);
    const timelinessScore = ConfidenceCalculator.computeTimelinessScore(l0);

    const overallConfidence =
      completionScore * W_COMPLETION + accuracyScore * W_ACCURACY + timelinessScore * W_TIMELINESS;

    return { completionScore, accuracyScore, timelinessScore, overallConfidence };
  }

  static computeForL1(l1: JudgmentObjective, l2s: readonly ExecutionObjective[]): number {
    const linked = l2s.filter((l2) => l2.l1Id === l1.id);
    const completionScore = ConfidenceCalculator.computeCompletionScore(linked);
    const accuracyScore = l1.accuracyRate * 100;
    return (completionScore * 0.5 + accuracyScore * 0.5) / 100;
  }

  private static computeCompletionScore(l2s: readonly ExecutionObjective[]): number {
    if (l2s.length === 0) return 0;
    const completed = l2s.filter((l2) => l2.isCompleted).length;
    return (completed / l2s.length) * 100;
  }

  private static computeAccuracyScore(l1s: readonly JudgmentObjective[]): number {
    if (l1s.length === 0) return 0;
    const totalAccuracy = l1s.reduce((sum, l1) => sum + l1.accuracyRate, 0);
    return (totalAccuracy / l1s.length) * 100;
  }

  private static computeTimelinessScore(l0: StrategicObjective): number {
    const horizonMs = ConfidenceCalculator.horizonToMs(l0.timeHorizon);
    const elapsed = Date.now() - l0.createdAt;
    const ratio = Math.min(1, elapsed / horizonMs);

    if (ratio <= 0.3) return 100;
    if (ratio <= 0.7) return 100 - (ratio - 0.3) * 75;
    return Math.max(0, 100 - (ratio - 0.3) * 100);
  }

  private static horizonToMs(horizon: string): number {
    switch (horizon) {
      case 'quarterly':
        return 90 * 24 * 60 * 60 * 1000;
      case 'half-year':
        return 180 * 24 * 60 * 60 * 1000;
      case 'annual':
        return 365 * 24 * 60 * 60 * 1000;
      case 'multi-year':
        return 730 * 24 * 60 * 60 * 1000;
      default:
        return 365 * 24 * 60 * 60 * 1000;
    }
  }
}
