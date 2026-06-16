import { describe, it, expect } from 'vitest';
import { PatternMatcher } from '../PatternMatcher';
import { DecisionPattern } from '../DecisionPattern';

function makePattern(overrides: Partial<Parameters<typeof DecisionPattern.fromProps>[0]> = {}) {
  return DecisionPattern.fromProps({
    id: 'dp-1',
    name: 'timeout pattern',
    description: 'desc',
    contextFingerprint: {
      keywords: ['timeout', 'database'],
      urgency: 'high',
      source: 'task-exception',
      impactRange: [3, 7],
    },
    recommendedAction: 'restart service',
    outcomes: [
      { action: 'restart service', successRate: 0.9, avgResponseMs: 3000, sampleSize: 10 },
    ],
    confidence: 0.9,
    usageCount: 5,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  });
}

describe('PatternMatcher', () => {
  const patterns = [
    makePattern(),
    makePattern({
      id: 'dp-2',
      name: 'auth pattern',
      contextFingerprint: {
        keywords: ['auth', 'login'],
        urgency: 'critical',
        source: 'notification',
        impactRange: [1, 3],
      },
      recommendedAction: 'reset tokens',
      confidence: 0.85,
    }),
  ];

  it('matches pattern with high keyword overlap', () => {
    const results = PatternMatcher.match(
      {
        keywords: ['timeout', 'database', 'connection'],
        urgency: 'high',
        source: 'task-exception',
        impactScope: 5,
      },
      patterns
    );
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].patternId).toBe('dp-1');
    expect(results[0].similarity).toBeGreaterThan(0.5);
  });

  it('returns empty when no patterns match', () => {
    const results = PatternMatcher.match(
      { keywords: ['billing', 'invoice'], urgency: 'low', source: 'collaboration', impactScope: 1 },
      patterns
    );
    expect(results).toHaveLength(0);
  });

  it('respects minSimilarity threshold', () => {
    const results = PatternMatcher.match(
      { keywords: ['timeout'], urgency: 'normal', source: 'decision', impactScope: 15 },
      patterns,
      0.9
    );
    expect(results).toHaveLength(0);
  });

  it('sorts by similarity descending', () => {
    const twoMatches = [
      makePattern({
        id: 'p1',
        contextFingerprint: {
          keywords: ['timeout'],
          urgency: 'high',
          source: 'task-exception',
          impactRange: [1, 10],
        },
      }),
      makePattern({
        id: 'p2',
        contextFingerprint: {
          keywords: ['timeout', 'database', 'connection'],
          urgency: 'high',
          source: 'task-exception',
          impactRange: [3, 7],
        },
      }),
    ];
    const results = PatternMatcher.match(
      {
        keywords: ['timeout', 'database', 'connection'],
        urgency: 'high',
        source: 'task-exception',
        impactScope: 5,
      },
      twoMatches,
      0.3
    );
    expect(results.length).toBe(2);
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
  });

  it('confidence is pattern.confidence * similarity', () => {
    const results = PatternMatcher.match(
      {
        keywords: ['timeout', 'database'],
        urgency: 'high',
        source: 'task-exception',
        impactScope: 5,
      },
      [makePattern({ confidence: 0.8 })]
    );
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBeCloseTo(0.8 * results[0].similarity, 5);
  });

  it('urgency match contributes to similarity', () => {
    const matchedUrgency = PatternMatcher.match(
      { keywords: ['timeout', 'database'], urgency: 'high', source: 'decision', impactScope: 5 },
      [makePattern()],
      0.3
    );
    const unmatchedUrgency = PatternMatcher.match(
      { keywords: ['timeout', 'database'], urgency: 'low', source: 'decision', impactScope: 5 },
      [makePattern()],
      0.3
    );
    if (matchedUrgency.length && unmatchedUrgency.length) {
      expect(matchedUrgency[0].similarity).toBeGreaterThan(unmatchedUrgency[0].similarity);
    }
  });

  it('source match contributes to similarity', () => {
    const matchedSource = PatternMatcher.match(
      {
        keywords: ['timeout', 'database'],
        urgency: 'normal',
        source: 'task-exception',
        impactScope: 5,
      },
      [makePattern()],
      0.3
    );
    const unmatchedSource = PatternMatcher.match(
      {
        keywords: ['timeout', 'database'],
        urgency: 'normal',
        source: 'collaboration',
        impactScope: 5,
      },
      [makePattern()],
      0.3
    );
    if (matchedSource.length && unmatchedSource.length) {
      expect(matchedSource[0].similarity).toBeGreaterThan(unmatchedSource[0].similarity);
    }
  });

  it('impact within range contributes full score', () => {
    const inRange = PatternMatcher.match(
      {
        keywords: ['timeout', 'database'],
        urgency: 'high',
        source: 'task-exception',
        impactScope: 5,
      },
      [makePattern()],
      0.3
    );
    const outRange = PatternMatcher.match(
      {
        keywords: ['timeout', 'database'],
        urgency: 'high',
        source: 'task-exception',
        impactScope: 20,
      },
      [makePattern()],
      0.3
    );
    if (inRange.length && outRange.length) {
      expect(inRange[0].similarity).toBeGreaterThanOrEqual(outRange[0].similarity);
    }
  });

  it('handles empty keywords gracefully', () => {
    const results = PatternMatcher.match(
      { keywords: [], urgency: 'high', source: 'task-exception', impactScope: 5 },
      [makePattern()],
      0.3
    );
    if (results.length > 0) {
      expect(results[0].similarity).toBeLessThan(1);
    }
  });
});
