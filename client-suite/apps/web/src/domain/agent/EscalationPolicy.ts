/**
 * EscalationPolicy — 升级策略
 *
 * 根据 TaskContract.escalationConditions 决定升级策略。
 * 评估当前 task 状态是否触发升级。
 */

import type { TaskContract, EscalationCondition } from './TaskContract';
import { EscalationChain, type StageConfig } from './EscalationChain';

export interface TaskState {
  readonly status: string;
  readonly failureCount: number;
  readonly elapsedMs: number;
  readonly tokensCost: number;
  readonly confidence: number;
  readonly isBlocked: boolean;
}

export interface PolicyEvaluation {
  readonly shouldEscalate: boolean;
  readonly triggeredConditions: EscalationCondition[];
  readonly suggestedChain: EscalationChain | null;
}

export class EscalationPolicy {
  static evaluate(contract: TaskContract, state: TaskState): PolicyEvaluation {
    const triggered: EscalationCondition[] = [];

    for (const condition of contract.escalationConditions) {
      if (EscalationPolicy.isTriggered(condition, state, contract)) {
        triggered.push(condition);
      }
    }

    if (triggered.length === 0) {
      return { shouldEscalate: false, triggeredConditions: [], suggestedChain: null };
    }

    const stages = EscalationPolicy.buildStages(triggered);
    const chain = EscalationChain.create(contract.id, stages);

    return {
      shouldEscalate: true,
      triggeredConditions: triggered,
      suggestedChain: chain,
    };
  }

  private static isTriggered(
    condition: EscalationCondition,
    state: TaskState,
    contract: TaskContract
  ): boolean {
    switch (condition.trigger) {
      case 'timeout':
        return state.elapsedMs >= condition.threshold;
      case 'failure-count':
        return state.failureCount >= condition.threshold;
      case 'confidence-drop':
        return state.confidence <= condition.threshold;
      case 'cost-overrun':
        return state.tokensCost >= contract.estimatedCostTokens * condition.threshold;
      case 'dependency-blocked':
        return state.isBlocked;
      default:
        return false;
    }
  }

  private static buildStages(conditions: EscalationCondition[]): StageConfig[] {
    const stageOrder: EscalationCondition['action'][] = [
      'retry',
      'degrade',
      'swap-agent',
      'escalate-human',
    ];
    const actions = new Set(conditions.map((c) => c.action));

    const stages: StageConfig[] = [];
    for (const action of stageOrder) {
      if (actions.has(action) || stages.length === 0) {
        stages.push(EscalationPolicy.defaultStageConfig(action));
      }
    }

    if (!stages.some((s) => s.stage === 'escalate-human')) {
      stages.push(EscalationPolicy.defaultStageConfig('escalate-human'));
    }

    return stages;
  }

  private static defaultStageConfig(action: EscalationCondition['action']): StageConfig {
    switch (action) {
      case 'retry':
        return { stage: 'retry', maxAttempts: 3, timeoutMs: 30_000 };
      case 'degrade':
        return {
          stage: 'degrade',
          maxAttempts: 1,
          timeoutMs: 60_000,
          degradeStrategy: 'reduce-scope',
        };
      case 'swap-agent':
        return { stage: 'swap-agent', maxAttempts: 2, timeoutMs: 120_000 };
      case 'escalate-human':
        return { stage: 'escalate-human', maxAttempts: 1, timeoutMs: 3_600_000 };
    }
  }
}
