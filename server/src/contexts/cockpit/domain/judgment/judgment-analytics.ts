/**
 * JudgmentAnalytics — 判断质量统计域服务（v2.1 EAOS 判断子系统，1:1 对标前端 JudgmentAnalytics）。
 *
 * 从 JudgmentRecord 集合提取统计指标：
 * - responseTime：响应时间分布（mean/median/p90/min/max，基于 responseDurationMs）
 * - actionDistribution：各响应动作分布（accepted/modified/declined/deferred/expired）
 * - sourceDistribution：各决策来源分布
 * - timeliness：判断及时性（1h 内响应为 onTime，对标前端硬编码 3600_000 阈值）
 * - averageAlternativeCount：平均备选方案数
 *
 * 1:1 复刻前端语义避免前后端 analytics 分裂（§6.4）。纯函数，零外部依赖（守 §1.1 domain 纪律）。
 * cockpit 元数据百级量，全量 list 后内存算可接受（同 pagination.ts 判断）；量大需 DB 聚合优化记 backlog。
 */

import type { JudgmentRecord } from './judgment-record.js';
import type { DecisionResponseStatus } from './decision.js';

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

/** 1h 内响应判定为及时（对标前端 JudgmentAnalytics 硬编码阈值）。 */
const TIMELINESS_THRESHOLD_MS = 3600_000;

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
    const actionMap = actionDist as unknown as Record<string, number>;
    const sourceDist: Record<string, number> = {};
    let onTime = 0;
    let totalAlts = 0;

    for (const r of records) {
      const action = r.action as DecisionResponseStatus;
      if (action in actionDist) {
        actionMap[action]++;
      }

      const src = r.source as string;
      sourceDist[src] = (sourceDist[src] || 0) + 1;

      totalAlts += r.contextSnapshot.alternativeCount;

      if (r.responseDurationMs <= TIMELINESS_THRESHOLD_MS) {
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
