/**
 * DivisionPolicy — 人机分工策略配置
 *
 * 定义在什么条件下切换分工模式（auto → human-approve → human-review → human-lead）。
 */

export type DivisionMode = 'auto' | 'human-approve' | 'human-review' | 'human-lead';

export interface ModeTransitionRule {
  readonly from: DivisionMode;
  readonly to: DivisionMode;
  readonly condition: TransitionCondition;
  readonly description: string;
}

export type TransitionCondition =
  | { type: 'determinism-drop'; threshold: number }
  | { type: 'risk-increase'; threshold: number }
  | { type: 'failure-streak'; count: number }
  | { type: 'confidence-below'; threshold: number }
  | { type: 'manual-override' };

export interface DivisionPolicyProps {
  rules: ModeTransitionRule[];
  defaultMode: DivisionMode;
  cooldownMs: number;
}

const DEFAULT_RULES: ModeTransitionRule[] = [
  {
    from: 'auto',
    to: 'human-approve',
    condition: { type: 'determinism-drop', threshold: 0.7 },
    description: '确定性降至70%以下，需人工审批',
  },
  {
    from: 'auto',
    to: 'human-review',
    condition: { type: 'failure-streak', count: 3 },
    description: '连续3次失败，切换人工复核',
  },
  {
    from: 'human-approve',
    to: 'human-lead',
    condition: { type: 'risk-increase', threshold: 0.8 },
    description: '风险升至80%以上，人主导',
  },
  {
    from: 'human-approve',
    to: 'auto',
    condition: { type: 'confidence-below', threshold: 0.9 },
    description: '置信度恢复到90%以上可回归自主',
  },
  {
    from: 'human-review',
    to: 'human-lead',
    condition: { type: 'risk-increase', threshold: 0.9 },
    description: '风险极高，人全面主导',
  },
];

export class DivisionPolicy {
  readonly rules: readonly ModeTransitionRule[];
  readonly defaultMode: DivisionMode;
  readonly cooldownMs: number;

  private constructor(props: DivisionPolicyProps) {
    this.rules = props.rules;
    this.defaultMode = props.defaultMode;
    this.cooldownMs = props.cooldownMs;
  }

  static createDefault(): DivisionPolicy {
    return new DivisionPolicy({
      rules: DEFAULT_RULES,
      defaultMode: 'auto',
      cooldownMs: 300_000,
    });
  }

  static fromProps(props: DivisionPolicyProps): DivisionPolicy {
    return new DivisionPolicy(props);
  }

  evaluateTransition(
    currentMode: DivisionMode,
    context: { determinism: number; risk: number; failureStreak: number; confidence: number }
  ): DivisionMode {
    const applicable = this.rules.filter((r) => r.from === currentMode);

    for (const rule of applicable) {
      if (DivisionPolicy.conditionMet(rule.condition, context)) {
        return rule.to;
      }
    }
    return currentMode;
  }

  getTransitionRulesFor(mode: DivisionMode): readonly ModeTransitionRule[] {
    return this.rules.filter((r) => r.from === mode);
  }

  addRule(rule: ModeTransitionRule): DivisionPolicy {
    return new DivisionPolicy({
      rules: [...this.rules, rule],
      defaultMode: this.defaultMode,
      cooldownMs: this.cooldownMs,
    });
  }

  removeRule(from: DivisionMode, to: DivisionMode): DivisionPolicy {
    return new DivisionPolicy({
      rules: this.rules.filter((r) => !(r.from === from && r.to === to)),
      defaultMode: this.defaultMode,
      cooldownMs: this.cooldownMs,
    });
  }

  private static conditionMet(
    condition: TransitionCondition,
    ctx: { determinism: number; risk: number; failureStreak: number; confidence: number }
  ): boolean {
    switch (condition.type) {
      case 'determinism-drop':
        return ctx.determinism < condition.threshold;
      case 'risk-increase':
        return ctx.risk > condition.threshold;
      case 'failure-streak':
        return ctx.failureStreak >= condition.count;
      case 'confidence-below':
        return ctx.confidence >= condition.threshold;
      case 'manual-override':
        return false;
    }
  }
}
