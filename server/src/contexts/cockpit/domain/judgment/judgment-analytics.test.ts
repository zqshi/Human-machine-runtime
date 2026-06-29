import { describe, it, expect } from 'vitest';
import { JudgmentAnalytics } from './judgment-analytics.js';
import { JudgmentRecord } from './judgment-record.js';

function record(opts: {
  action: 'accepted' | 'modified' | 'declined' | 'deferred' | 'expired';
  source: string;
  respondedAt: number;
  createdAt: number;
  alternativeCount: number;
}): JudgmentRecord {
  return JudgmentRecord.create({
    decisionId: 'dec-x',
    source: opts.source as never,
    action: opts.action,
    respondedAt: opts.respondedAt,
    createdAt: opts.createdAt,
    contextSnapshot: {
      title: 'T',
      context: 'C',
      urgency: 'normal',
      recommendationLabel: 'L',
      alternativeCount: opts.alternativeCount,
    },
  });
}

describe('JudgmentAnalytics', () => {
  describe('empty', () => {
    it('全 0 空快照', () => {
      const s = JudgmentAnalytics.empty();
      expect(s.totalRecords).toBe(0);
      expect(s.responseTime).toEqual({ mean: 0, median: 0, p90: 0, min: 0, max: 0 });
      expect(s.actionDistribution).toEqual({
        accepted: 0,
        modified: 0,
        declined: 0,
        deferred: 0,
        expired: 0,
      });
      expect(s.sourceDistribution).toEqual({});
      expect(s.timeliness).toEqual({ onTime: 0, late: 0, total: 0, onTimeRate: 0 });
      expect(s.averageAlternativeCount).toBe(0);
    });
  });

  describe('compute', () => {
    it('空数组返回 empty', () => {
      expect(JudgmentAnalytics.compute([]).totalRecords).toBe(0);
    });

    it('totalRecords + actionDistribution + sourceDistribution', () => {
      const records = [
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 1_000,
          createdAt: 0,
          alternativeCount: 2,
        }),
        record({
          action: 'declined',
          source: 'risk-rule-trigger',
          respondedAt: 2_000,
          createdAt: 0,
          alternativeCount: 1,
        }),
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 3_000,
          createdAt: 0,
          alternativeCount: 3,
        }),
      ];
      const s = JudgmentAnalytics.compute(records);
      expect(s.totalRecords).toBe(3);
      expect(s.actionDistribution.accepted).toBe(2);
      expect(s.actionDistribution.declined).toBe(1);
      expect(s.actionDistribution.modified).toBe(0);
      expect(s.sourceDistribution['agent-discovery']).toBe(2);
      expect(s.sourceDistribution['risk-rule-trigger']).toBe(1);
    });

    it('responseTime：mean/median/p90/min/max 基于 responseDurationMs（升序）', () => {
      // durations: [1000, 2000, 3000, 4000]
      const records = [
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 1_000,
          createdAt: 0,
          alternativeCount: 0,
        }),
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 2_000,
          createdAt: 0,
          alternativeCount: 0,
        }),
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 3_000,
          createdAt: 0,
          alternativeCount: 0,
        }),
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 4_000,
          createdAt: 0,
          alternativeCount: 0,
        }),
      ];
      const s = JudgmentAnalytics.compute(records);
      expect(s.responseTime.min).toBe(1_000);
      expect(s.responseTime.max).toBe(4_000);
      expect(s.responseTime.mean).toBe(2_500);
      expect(s.responseTime.median).toBe(3_000); // durations[2] (floor(4/2)=2)
      expect(s.responseTime.p90).toBe(4_000); // durations[floor(4*0.9)=3]
    });

    it('timeliness：responseDurationMs <= 1h 算 onTime', () => {
      const records = [
        // 500ms onTime, 2000ms onTime, 4000_000ms(>1h) late
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 500,
          createdAt: 0,
          alternativeCount: 0,
        }),
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 2_000,
          createdAt: 0,
          alternativeCount: 0,
        }),
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 3_600_000,
          createdAt: 0,
          alternativeCount: 0,
        }),
      ];
      const s = JudgmentAnalytics.compute(records);
      expect(s.timeliness.total).toBe(3);
      expect(s.timeliness.onTime).toBe(3); // 3600_000 <= 3600_000 边界算 onTime
      expect(s.timeliness.late).toBe(0);
      expect(s.timeliness.onTimeRate).toBe(1);
    });

    it('timeliness：超 1h 算 late', () => {
      const records = [
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 3_600_001,
          createdAt: 0,
          alternativeCount: 0,
        }),
      ];
      const s = JudgmentAnalytics.compute(records);
      expect(s.timeliness.onTime).toBe(0);
      expect(s.timeliness.late).toBe(1);
      expect(s.timeliness.onTimeRate).toBe(0);
    });

    it('averageAlternativeCount：四舍五入一位小数', () => {
      const records = [
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 1,
          createdAt: 0,
          alternativeCount: 2,
        }),
        record({
          action: 'accepted',
          source: 'agent-discovery',
          respondedAt: 1,
          createdAt: 0,
          alternativeCount: 3,
        }),
      ];
      const s = JudgmentAnalytics.compute(records);
      expect(s.averageAlternativeCount).toBe(2.5);
    });

    it('computedAt 为当前时间戳', () => {
      const s = JudgmentAnalytics.compute([]);
      expect(s.computedAt).toBeLessThanOrEqual(Date.now());
    });
  });
});
