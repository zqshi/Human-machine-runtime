import { describe, it, expect } from 'vitest';
import { DecisionPattern } from '../DecisionPattern';
import { PatternMatcher } from '../PatternMatcher';

describe('DecisionPattern', () => {
  it('creates and records usage', () => {
    const pattern = DecisionPattern.create({
      name: '紧急预算超支',
      description: '预算超支时的标准响应',
      contextFingerprint: {
        keywords: ['预算', '超支', '紧急'],
        urgency: 'critical',
        source: 'decision',
        impactRange: [3, 8],
      },
      recommendedAction: 'pause',
      outcomes: [],
    });

    expect(pattern.usageCount).toBe(0);
    expect(pattern.confidence).toBe(0);

    const used = pattern.recordUsage({
      action: 'pause',
      successRate: 0.9,
      avgResponseMs: 5000,
      sampleSize: 10,
    });

    expect(used.usageCount).toBe(1);
    expect(used.confidence).toBe(0.9);
    expect(used.recommendedAction).toBe('pause');
  });

  it('merges outcomes for same action', () => {
    const pattern = DecisionPattern.create({
      name: 'test',
      description: 'test',
      contextFingerprint: {
        keywords: ['test'],
        urgency: 'normal',
        source: 'decision',
        impactRange: [1, 5],
      },
      recommendedAction: 'accept',
      outcomes: [{ action: 'accept', successRate: 0.8, avgResponseMs: 3000, sampleSize: 20 }],
    });

    const updated = pattern.recordUsage({
      action: 'accept',
      successRate: 1.0,
      avgResponseMs: 1000,
      sampleSize: 10,
    });

    expect(updated.outcomes).toHaveLength(1);
    expect(updated.outcomes[0].sampleSize).toBe(30);
    expect(updated.outcomes[0].successRate).toBeCloseTo(0.867, 2);
  });
});

describe('PatternMatcher', () => {
  it('matches patterns by context similarity', () => {
    const patterns = [
      DecisionPattern.create({
        name: '预算超支',
        description: 'test',
        contextFingerprint: {
          keywords: ['预算', '超支', '紧急'],
          urgency: 'critical',
          source: 'decision',
          impactRange: [3, 8],
        },
        recommendedAction: 'pause',
        outcomes: [{ action: 'pause', successRate: 0.9, avgResponseMs: 5000, sampleSize: 10 }],
      }),
      DecisionPattern.create({
        name: '性能下降',
        description: 'test',
        contextFingerprint: {
          keywords: ['性能', '下降', '延迟'],
          urgency: 'high',
          source: 'task-exception',
          impactRange: [1, 3],
        },
        recommendedAction: 'retry',
        outcomes: [{ action: 'retry', successRate: 0.7, avgResponseMs: 2000, sampleSize: 5 }],
      }),
    ];

    const results = PatternMatcher.match(
      {
        keywords: ['预算', '超支', '审批'],
        urgency: 'critical',
        source: 'decision',
        impactScope: 5,
      },
      patterns,
      0.5
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].patternName).toBe('预算超支');
    expect(results[0].similarity).toBeGreaterThan(0.5);
  });

  it('returns empty for no matches', () => {
    const patterns = [
      DecisionPattern.create({
        name: 'test',
        description: 'test',
        contextFingerprint: {
          keywords: ['completely', 'different'],
          urgency: 'low',
          source: 'notification',
          impactRange: [1, 2],
        },
        recommendedAction: 'accept',
        outcomes: [],
      }),
    ];

    const results = PatternMatcher.match(
      { keywords: ['预算', '超支'], urgency: 'critical', source: 'decision', impactScope: 5 },
      patterns,
      0.8
    );

    expect(results).toHaveLength(0);
  });
});
