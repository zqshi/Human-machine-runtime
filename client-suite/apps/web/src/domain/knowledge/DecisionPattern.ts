/**
 * DecisionPattern — 决策模式
 *
 * 从历史决策中提取的可复用模式：
 * context fingerprint + decision + outcome → 模板
 */

export interface PatternContext {
  readonly keywords: readonly string[];
  readonly urgency: string;
  readonly source: string;
  readonly impactRange: [number, number];
}

export interface PatternOutcome {
  readonly action: string;
  readonly successRate: number;
  readonly avgResponseMs: number;
  readonly sampleSize: number;
}

export interface DecisionPatternProps {
  id: string;
  name: string;
  description: string;
  contextFingerprint: PatternContext;
  recommendedAction: string;
  outcomes: PatternOutcome[];
  confidence: number;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export class DecisionPattern {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly contextFingerprint: PatternContext;
  readonly recommendedAction: string;
  readonly outcomes: readonly PatternOutcome[];
  readonly confidence: number;
  readonly usageCount: number;
  readonly createdAt: number;
  readonly updatedAt: number;

  private constructor(props: DecisionPatternProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.contextFingerprint = props.contextFingerprint;
    this.recommendedAction = props.recommendedAction;
    this.outcomes = props.outcomes;
    this.confidence = props.confidence;
    this.usageCount = props.usageCount;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    props: Omit<
      DecisionPatternProps,
      'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'confidence'
    >
  ): DecisionPattern {
    const now = Date.now();
    return new DecisionPattern({
      ...props,
      id: `dp-${now}-${Math.random().toString(36).slice(2, 7)}`,
      usageCount: 0,
      confidence: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: DecisionPatternProps): DecisionPattern {
    return new DecisionPattern(props);
  }

  recordUsage(outcome: PatternOutcome): DecisionPattern {
    const existing = this.outcomes.find((o) => o.action === outcome.action);
    let updated: PatternOutcome[];
    if (existing) {
      const totalSample = existing.sampleSize + outcome.sampleSize;
      const mergedRate =
        (existing.successRate * existing.sampleSize + outcome.successRate * outcome.sampleSize) /
        totalSample;
      updated = this.outcomes.map((o) =>
        o.action === outcome.action
          ? {
              ...o,
              successRate: mergedRate,
              sampleSize: totalSample,
              avgResponseMs: Math.round((o.avgResponseMs + outcome.avgResponseMs) / 2),
            }
          : o
      );
    } else {
      updated = [...this.outcomes, outcome];
    }

    const bestOutcome = updated.reduce(
      (best, o) => (o.successRate > best.successRate ? o : best),
      updated[0]
    );

    return new DecisionPattern({
      ...this.toProps(),
      outcomes: updated,
      usageCount: this.usageCount + 1,
      confidence: bestOutcome.successRate,
      recommendedAction: bestOutcome.action,
      updatedAt: Date.now(),
    });
  }

  get bestOutcome(): PatternOutcome | undefined {
    if (this.outcomes.length === 0) return undefined;
    return this.outcomes.reduce((best, o) => (o.successRate > best.successRate ? o : best));
  }

  private toProps(): DecisionPatternProps {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      contextFingerprint: this.contextFingerprint,
      recommendedAction: this.recommendedAction,
      outcomes: [...this.outcomes],
      confidence: this.confidence,
      usageCount: this.usageCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
