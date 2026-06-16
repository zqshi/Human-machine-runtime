/**
 * JudgmentAnalytics — 判断质量统计域服务
 *
 * 从 JudgmentRecord 集合中提取统计指标：
 * - 响应时间分布
 * - 各来源/动作的分布
 * - 判断及时性（deadline 前/后）
 */

import type { JudgmentRecord } from './JudgmentRecord';

export interface ResponseTimeStats {
  readonly mean: number;
  readonly median: number;
  readonly p90: number;
  readonly min: number;
  readonly max: number;
}

export interface ActionDistribution {
  readonly accepted: number;
  readonly modified: number;
  readonly declined: number;
  readonly deferred: number;
  readonly expired: number;
}

export interface SourceDistribution {
  readonly [source: string]: number;
}

export interface TimelinessStats {
  readonly onTime: number;
  readonly late: number;
  readonly total: number;
  readonly onTimeRate: number;
}

export interface JudgmentAnalyticsSnapshot {
  readonly totalRecords: number;
  readonly responseTime: ResponseTimeStats;
  readonly actionDistribution: ActionDistribution;
  readonly sourceDistribution: SourceDistribution;
  readonly timeliness: TimelinessStats;
  readonly averageAlternativeCount: number;
  readonly computedAt: number;
}

export class JudgmentAnalytics {
  static compute(records: readonly JudgmentRecord[]): JudgmentAnalyticsSnapshot {
    if (records.length === 0) {
      return JudgmentAnalytics.empty();
    }

    const durations = records.map((r) => r.responseDurationMs).sort((a, b) => a - b);

    const actionDist: ActionDistribution = {
      accepted: 0,
      modified: 0,
      declined: 0,
      deferred: 0,
      expired: 0,
    };
    const sourceDist: Record<string, number> = {};
    let onTime = 0;
    let totalAlts = 0;

    for (const r of records) {
      const action = r.action as keyof ActionDistribution;
      if (action in actionDist) {
        (actionDist as unknown as Record<string, number>)[action]++;
      }

      const src = r.source as string;
      sourceDist[src] = (sourceDist[src] || 0) + 1;

      totalAlts += r.contextSnapshot.alternativeCount;

      if (r.responseDurationMs <= 3600_000) {
        onTime++;
      }
    }

    return {
      totalRecords: records.length,
      responseTime: {
        mean: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        median: durations[Math.floor(durations.length / 2)],
        p90: durations[Math.floor(durations.length * 0.9)],
        min: durations[0],
        max: durations[durations.length - 1],
      },
      actionDistribution: actionDist,
      sourceDistribution: sourceDist,
      timeliness: {
        onTime,
        late: records.length - onTime,
        total: records.length,
        onTimeRate: onTime / records.length,
      },
      averageAlternativeCount: Math.round((totalAlts / records.length) * 10) / 10,
      computedAt: Date.now(),
    };
  }

  static empty(): JudgmentAnalyticsSnapshot {
    return {
      totalRecords: 0,
      responseTime: { mean: 0, median: 0, p90: 0, min: 0, max: 0 },
      actionDistribution: { accepted: 0, modified: 0, declined: 0, deferred: 0, expired: 0 },
      sourceDistribution: {},
      timeliness: { onTime: 0, late: 0, total: 0, onTimeRate: 0 },
      averageAlternativeCount: 0,
      computedAt: Date.now(),
    };
  }
}
