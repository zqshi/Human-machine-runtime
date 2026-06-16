/**
 * HumanAgentDivisionEngine — 人机动态分工引擎
 *
 * 确定性×风险二维评估矩阵：
 * - auto: 高确定性 + 低风险 → AI 完全自主
 * - human-approve: 高确定性 + 高风险 → AI 执行、人审批
 * - human-review: 低确定性 + 低风险 → AI 建议、人选择
 * - human-lead: 低确定性 + 高风险 → 人主导、AI 辅助
 */

export type DivisionMode = 'auto' | 'human-approve' | 'human-review' | 'human-lead';

export interface DivisionContext {
  readonly determinism: number;
  readonly riskLevel: number;
  readonly historicalSuccessRate: number;
  readonly impactScope: number;
  readonly isReversible: boolean;
  readonly dataCompleteness: number;
}

export interface DivisionResult {
  readonly mode: DivisionMode;
  readonly confidence: number;
  readonly reasoning: string;
  readonly humanRole: string;
  readonly agentRole: string;
}

export interface DivisionPolicy {
  readonly determinismThreshold: number;
  readonly riskThreshold: number;
  readonly minHistoricalRate: number;
}

const DEFAULT_POLICY: DivisionPolicy = {
  determinismThreshold: 0.7,
  riskThreshold: 0.5,
  minHistoricalRate: 0.8,
};

export class HumanAgentDivisionEngine {
  private readonly policy: DivisionPolicy;

  constructor(policy?: Partial<DivisionPolicy>) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  evaluate(ctx: DivisionContext): DivisionResult {
    const effectiveDeterminism = this.adjustDeterminism(ctx);
    const effectiveRisk = this.adjustRisk(ctx);

    const highDeterminism = effectiveDeterminism >= this.policy.determinismThreshold;
    const highRisk = effectiveRisk >= this.policy.riskThreshold;

    if (highDeterminism && !highRisk) {
      return {
        mode: 'auto',
        confidence: effectiveDeterminism,
        reasoning: '高确定性 + 低风险：AI 可完全自主执行',
        humanRole: '无需介入',
        agentRole: '完全执行',
      };
    }

    if (highDeterminism && highRisk) {
      return {
        mode: 'human-approve',
        confidence: effectiveDeterminism,
        reasoning: '高确定性 + 高风险：AI 执行方案，人审批确认',
        humanRole: '审批确认',
        agentRole: '执行 + 等待审批',
      };
    }

    if (!highDeterminism && !highRisk) {
      return {
        mode: 'human-review',
        confidence: effectiveDeterminism,
        reasoning: '低确定性 + 低风险：AI 给出建议，人选择方向',
        humanRole: '选择方向',
        agentRole: '提供选项和建议',
      };
    }

    return {
      mode: 'human-lead',
      confidence: effectiveDeterminism,
      reasoning: '低确定性 + 高风险：人主导决策，AI 辅助分析',
      humanRole: '主导决策',
      agentRole: '辅助分析和执行',
    };
  }

  private adjustDeterminism(ctx: DivisionContext): number {
    let d = ctx.determinism;

    if (ctx.dataCompleteness < 0.5) {
      d -= (0.5 - ctx.dataCompleteness) * 0.3;
    }

    if (ctx.historicalSuccessRate < this.policy.minHistoricalRate) {
      d -= (this.policy.minHistoricalRate - ctx.historicalSuccessRate) * 0.4;
    }

    return Math.max(0, Math.min(1, d));
  }

  private adjustRisk(ctx: DivisionContext): number {
    let r = ctx.riskLevel;

    if (!ctx.isReversible) {
      r += 0.2;
    }

    if (ctx.impactScope > 5) {
      r += Math.min(0.2, (ctx.impactScope - 5) * 0.04);
    }

    return Math.max(0, Math.min(1, r));
  }

  withPolicy(policy: Partial<DivisionPolicy>): HumanAgentDivisionEngine {
    return new HumanAgentDivisionEngine({ ...this.policy, ...policy });
  }
}
