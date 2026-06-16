/**
 * PatternMatcher — 模式匹配器
 *
 * 新决策进入时，匹配历史模式给出推荐。
 * 匹配维度：关键词重叠度 + urgency 匹配 + source 匹配 + impact 范围重叠。
 */

import type { DecisionPattern, PatternContext } from './DecisionPattern';

export interface MatchResult {
  readonly patternId: string;
  readonly patternName: string;
  readonly similarity: number;
  readonly recommendedAction: string;
  readonly confidence: number;
}

export class PatternMatcher {
  static match(
    context: { keywords: string[]; urgency: string; source: string; impactScope: number },
    patterns: readonly DecisionPattern[],
    minSimilarity = 0.5
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const pattern of patterns) {
      const similarity = PatternMatcher.computeSimilarity(context, pattern.contextFingerprint);
      if (similarity >= minSimilarity) {
        results.push({
          patternId: pattern.id,
          patternName: pattern.name,
          similarity,
          recommendedAction: pattern.recommendedAction,
          confidence: pattern.confidence * similarity,
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  private static computeSimilarity(
    ctx: { keywords: string[]; urgency: string; source: string; impactScope: number },
    fingerprint: PatternContext
  ): number {
    let score = 0;
    let weights = 0;

    const keywordOverlap = PatternMatcher.keywordSimilarity(ctx.keywords, fingerprint.keywords);
    score += keywordOverlap * 0.4;
    weights += 0.4;

    if (ctx.urgency === fingerprint.urgency) {
      score += 0.25;
    }
    weights += 0.25;

    if (ctx.source === fingerprint.source) {
      score += 0.2;
    }
    weights += 0.2;

    const [min, max] = fingerprint.impactRange;
    if (ctx.impactScope >= min && ctx.impactScope <= max) {
      score += 0.15;
    } else {
      const distance = ctx.impactScope < min ? min - ctx.impactScope : ctx.impactScope - max;
      score += Math.max(0, 0.15 - distance * 0.03);
    }
    weights += 0.15;

    return score / weights;
  }

  private static keywordSimilarity(a: readonly string[], b: readonly string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const setA = new Set(a.map((w) => w.toLowerCase()));
    const setB = new Set(b.map((w) => w.toLowerCase()));
    const intersection = [...setA].filter((w) => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return intersection / union;
  }
}
