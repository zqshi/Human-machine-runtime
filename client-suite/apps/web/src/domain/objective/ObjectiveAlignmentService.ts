/**
 * ObjectiveAlignmentService — 目标对齐服务
 *
 * 管理 L0→L1→L2 的拆解关系 + 计算对齐度。
 */

import type { StrategicObjective } from './StrategicObjective';
import type { JudgmentObjective } from './JudgmentObjective';
import type { ExecutionObjective } from './ExecutionObjective';

export interface AlignmentGap {
  readonly objectiveId: string;
  readonly level: 'L0' | 'L1' | 'L2';
  readonly gapType: 'unlinked' | 'underperforming' | 'blocked' | 'orphaned';
  readonly description: string;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface AlignmentReport {
  readonly l0Coverage: number;
  readonly l1Coverage: number;
  readonly l2Coverage: number;
  readonly gaps: AlignmentGap[];
  readonly overallAlignment: number;
  readonly computedAt: number;
}

export class ObjectiveAlignmentService {
  static computeAlignment(
    l0s: readonly StrategicObjective[],
    l1s: readonly JudgmentObjective[],
    l2s: readonly ExecutionObjective[]
  ): AlignmentReport {
    const gaps: AlignmentGap[] = [];

    const l0Coverage = ObjectiveAlignmentService.computeL0Coverage(l0s, l1s, gaps);
    const l1Coverage = ObjectiveAlignmentService.computeL1Coverage(l1s, l2s, gaps);
    const l2Coverage = ObjectiveAlignmentService.computeL2Coverage(l2s, l1s, gaps);

    ObjectiveAlignmentService.detectOrphans(l1s, l0s, l2s, gaps);

    const overallAlignment = (l0Coverage + l1Coverage + l2Coverage) / 3;

    return {
      l0Coverage,
      l1Coverage,
      l2Coverage,
      gaps,
      overallAlignment,
      computedAt: Date.now(),
    };
  }

  private static computeL0Coverage(
    l0s: readonly StrategicObjective[],
    l1s: readonly JudgmentObjective[],
    gaps: AlignmentGap[]
  ): number {
    if (l0s.length === 0) return 0;
    let covered = 0;
    for (const l0 of l0s) {
      const linked = l1s.filter((l1) => l0.linkedL1Ids.includes(l1.id));
      if (linked.length > 0) {
        covered++;
      } else {
        gaps.push({
          objectiveId: l0.id,
          level: 'L0',
          gapType: 'unlinked',
          description: `L0 "${l0.direction}" has no linked L1 objectives`,
          severity: 'high',
        });
      }
    }
    return covered / l0s.length;
  }

  private static computeL1Coverage(
    l1s: readonly JudgmentObjective[],
    l2s: readonly ExecutionObjective[],
    gaps: AlignmentGap[]
  ): number {
    if (l1s.length === 0) return 0;
    let covered = 0;
    for (const l1 of l1s) {
      const linked = l2s.filter((l2) => l2.l1Id === l1.id);
      if (linked.length > 0) {
        covered++;
        const failedRate = linked.filter((l2) => l2.isFailed).length / linked.length;
        if (failedRate > 0.5) {
          gaps.push({
            objectiveId: l1.id,
            level: 'L1',
            gapType: 'underperforming',
            description: `L1 "${l1.keyQuestion}" has >50% failed L2 executions`,
            severity: 'medium',
          });
        }
      } else {
        gaps.push({
          objectiveId: l1.id,
          level: 'L1',
          gapType: 'unlinked',
          description: `L1 "${l1.keyQuestion}" has no linked L2 objectives`,
          severity: 'medium',
        });
      }
    }
    return covered / l1s.length;
  }

  private static computeL2Coverage(
    l2s: readonly ExecutionObjective[],
    l1s: readonly JudgmentObjective[],
    gaps: AlignmentGap[]
  ): number {
    if (l2s.length === 0) return 0;
    let covered = 0;
    for (const l2 of l2s) {
      if (l1s.some((l1) => l1.id === l2.l1Id)) {
        covered++;
      } else {
        gaps.push({
          objectiveId: l2.id,
          level: 'L2',
          gapType: 'orphaned',
          description: `L2 "${l2.description}" links to non-existent L1`,
          severity: 'low',
        });
      }
    }
    return covered / l2s.length;
  }

  private static detectOrphans(
    l1s: readonly JudgmentObjective[],
    l0s: readonly StrategicObjective[],
    _l2s: readonly ExecutionObjective[],
    gaps: AlignmentGap[]
  ): void {
    for (const l1 of l1s) {
      const parentExists = l0s.some((l0) => l0.linkedL1Ids.includes(l1.id));
      if (!parentExists) {
        gaps.push({
          objectiveId: l1.id,
          level: 'L1',
          gapType: 'orphaned',
          description: `L1 "${l1.keyQuestion}" is not linked from any L0`,
          severity: 'medium',
        });
      }
    }
  }
}
