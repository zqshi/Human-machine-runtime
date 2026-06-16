/**
 * EscalationGate — 升维网关
 *
 * 置信度 < 阈值时唤醒人，否则 AI 自主流转。
 * 评估维度：确定性（可计算性）、风险等级、历史准确率。
 */

export type EscalationLevel = 'auto' | 'human-approve' | 'human-review' | 'human-lead';

export interface EscalationContext {
  readonly intentType: string;
  readonly agentId: string;
  readonly confidence: number;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly historicalAccuracy: number;
  readonly impactScope: number;
  readonly isReversible: boolean;
}

export interface EscalationDecision {
  readonly level: EscalationLevel;
  readonly reason: string;
  readonly confidence: number;
  readonly suggestedHumanAction?: string;
}

export interface EscalationThresholds {
  readonly autoThreshold: number;
  readonly approveThreshold: number;
  readonly reviewThreshold: number;
}

const DEFAULT_THRESHOLDS: EscalationThresholds = {
  autoThreshold: 0.9,
  approveThreshold: 0.7,
  reviewThreshold: 0.4,
};

export class EscalationGate {
  private readonly thresholds: EscalationThresholds;

  constructor(thresholds?: Partial<EscalationThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  evaluate(ctx: EscalationContext): EscalationDecision {
    const effectiveConfidence = this.computeEffectiveConfidence(ctx);

    if (ctx.riskLevel === 'critical') {
      return {
        level: 'human-lead',
        reason: 'Critical risk level requires human leadership',
        confidence: effectiveConfidence,
        suggestedHumanAction: 'Direct oversight and decision-making required',
      };
    }

    if (
      effectiveConfidence >= this.thresholds.autoThreshold &&
      ctx.riskLevel === 'low' &&
      ctx.isReversible
    ) {
      return {
        level: 'auto',
        reason: 'High confidence, low risk, reversible — AI autonomous',
        confidence: effectiveConfidence,
      };
    }

    if (effectiveConfidence >= this.thresholds.approveThreshold) {
      return {
        level: 'human-approve',
        reason: 'Moderate confidence — requires human approval before execution',
        confidence: effectiveConfidence,
        suggestedHumanAction: 'Review and approve the proposed action',
      };
    }

    if (effectiveConfidence >= this.thresholds.reviewThreshold) {
      return {
        level: 'human-review',
        reason: 'Low confidence — human review needed to select approach',
        confidence: effectiveConfidence,
        suggestedHumanAction: 'Evaluate alternatives and guide direction',
      };
    }

    return {
      level: 'human-lead',
      reason: 'Very low confidence — human must lead the decision',
      confidence: effectiveConfidence,
      suggestedHumanAction: 'Take ownership and provide explicit direction',
    };
  }

  shouldEscalate(ctx: EscalationContext): boolean {
    const decision = this.evaluate(ctx);
    return decision.level !== 'auto';
  }

  private computeEffectiveConfidence(ctx: EscalationContext): number {
    let base = ctx.confidence;

    const riskPenalty: Record<string, number> = {
      low: 0,
      medium: 0.1,
      high: 0.25,
      critical: 0.5,
    };
    base -= riskPenalty[ctx.riskLevel] ?? 0;

    if (ctx.historicalAccuracy < 0.7) {
      base -= (0.7 - ctx.historicalAccuracy) * 0.5;
    }

    if (!ctx.isReversible) {
      base -= 0.1;
    }

    if (ctx.impactScope > 5) {
      base -= Math.min(0.15, (ctx.impactScope - 5) * 0.03);
    }

    return Math.max(0, Math.min(1, base));
  }

  withThresholds(thresholds: Partial<EscalationThresholds>): EscalationGate {
    return new EscalationGate({ ...this.thresholds, ...thresholds });
  }

  getThresholds(): EscalationThresholds {
    return { ...this.thresholds };
  }
}
