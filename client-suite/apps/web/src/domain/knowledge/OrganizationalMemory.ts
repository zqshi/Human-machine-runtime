/**
 * OrganizationalMemory — 组织知识沉淀
 *
 * 从 JudgmentRecord 批量提取决策模式，按相似度检索可复用的历史决策。
 */

import { DecisionPattern, type PatternContext, type PatternOutcome } from './DecisionPattern';
import { PatternMatcher, type MatchResult } from './PatternMatcher';

export interface JudgmentSummary {
  readonly decisionId: string;
  readonly keywords: string[];
  readonly urgency: string;
  readonly source: string;
  readonly impact: number;
  readonly action: string;
  readonly outcome: 'success' | 'failure' | 'neutral';
  readonly responseMs: number;
}

export class OrganizationalMemory {
  private patterns: DecisionPattern[];

  private constructor(patterns: DecisionPattern[]) {
    this.patterns = patterns;
  }

  static create(): OrganizationalMemory {
    return new OrganizationalMemory([]);
  }

  static fromPatterns(patterns: DecisionPattern[]): OrganizationalMemory {
    return new OrganizationalMemory([...patterns]);
  }

  ingest(judgments: readonly JudgmentSummary[]): number {
    const grouped = OrganizationalMemory.groupByContext(judgments);
    let newPatterns = 0;

    for (const [key, group] of grouped.entries()) {
      if (group.length < 2) continue;

      const existing = this.findByContextKey(key);
      if (existing) {
        this.updatePatternFromGroup(existing, group);
      } else {
        const pattern = OrganizationalMemory.createPatternFromGroup(key, group);
        this.patterns.push(pattern);
        newPatterns++;
      }
    }

    return newPatterns;
  }

  search(context: PatternContext, limit: number = 5): MatchResult[] {
    const ctx = {
      keywords: [...context.keywords],
      urgency: context.urgency,
      source: context.source,
      impactScope: (context.impactRange[0] + context.impactRange[1]) / 2,
    };
    return PatternMatcher.match(ctx, this.patterns).slice(0, limit);
  }

  getAll(): readonly DecisionPattern[] {
    return this.patterns;
  }

  getById(id: string): DecisionPattern | undefined {
    return this.patterns.find((p) => p.id === id);
  }

  get size(): number {
    return this.patterns.length;
  }

  recordUsage(patternId: string, outcome: PatternOutcome): void {
    const idx = this.patterns.findIndex((p) => p.id === patternId);
    if (idx >= 0) {
      this.patterns[idx] = this.patterns[idx].recordUsage(outcome);
    }
  }

  pruneStale(maxAgeMs: number = 90 * 24 * 3600_000): number {
    const before = this.patterns.length;
    const threshold = Date.now() - maxAgeMs;
    this.patterns = this.patterns.filter((p) => p.updatedAt > threshold || p.usageCount > 10);
    return before - this.patterns.length;
  }

  private findByContextKey(key: string): DecisionPattern | undefined {
    return this.patterns.find((p) => OrganizationalMemory.contextKey(p.contextFingerprint) === key);
  }

  private updatePatternFromGroup(pattern: DecisionPattern, group: JudgmentSummary[]): void {
    const idx = this.patterns.indexOf(pattern);
    if (idx < 0) return;

    let updated = pattern;
    for (const j of group) {
      updated = updated.recordUsage({
        action: j.action,
        successRate: j.outcome === 'success' ? 1 : j.outcome === 'failure' ? 0 : 0.5,
        avgResponseMs: j.responseMs,
        sampleSize: 1,
      });
    }
    this.patterns[idx] = updated;
  }

  private static createPatternFromGroup(key: string, group: JudgmentSummary[]): DecisionPattern {
    const first = group[0];
    const allKeywords = [...new Set(group.flatMap((j) => j.keywords))];
    const impacts = group.map((j) => j.impact);
    const minImpact = Math.min(...impacts);
    const maxImpact = Math.max(...impacts);

    const context: PatternContext = {
      keywords: allKeywords.slice(0, 10),
      urgency: first.urgency,
      source: first.source,
      impactRange: [minImpact, maxImpact],
    };

    const actionGroups = new Map<string, JudgmentSummary[]>();
    for (const j of group) {
      const arr = actionGroups.get(j.action) ?? [];
      arr.push(j);
      actionGroups.set(j.action, arr);
    }

    const outcomes: PatternOutcome[] = [...actionGroups.entries()].map(([action, items]) => {
      const successes = items.filter((i) => i.outcome === 'success').length;
      return {
        action,
        successRate: items.length > 0 ? successes / items.length : 0,
        avgResponseMs: Math.round(items.reduce((s, i) => s + i.responseMs, 0) / items.length),
        sampleSize: items.length,
      };
    });

    const bestAction = outcomes.reduce(
      (best, o) => (o.successRate > best.successRate ? o : best),
      outcomes[0]
    );

    return DecisionPattern.create({
      name: `模式: ${allKeywords.slice(0, 3).join('+')}`,
      description: `从 ${group.length} 条判断记录中提取`,
      contextFingerprint: context,
      recommendedAction: bestAction.action,
      outcomes,
    });
  }

  private static groupByContext(
    judgments: readonly JudgmentSummary[]
  ): Map<string, JudgmentSummary[]> {
    const groups = new Map<string, JudgmentSummary[]>();
    for (const j of judgments) {
      const key = `${j.urgency}:${j.source}:${j.keywords.sort().slice(0, 3).join(',')}`;
      const arr = groups.get(key) ?? [];
      arr.push(j);
      groups.set(key, arr);
    }
    return groups;
  }

  private static contextKey(ctx: PatternContext): string {
    return `${ctx.urgency}:${ctx.source}:${ctx.keywords.slice(0, 3).join(',')}`;
  }
}
