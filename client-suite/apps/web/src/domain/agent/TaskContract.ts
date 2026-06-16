/**
 * TaskContract — 标准化任务契约
 *
 * 定义 Agent 执行任务的完整契约：
 * 目标 + 输入 + 验收标准 + 约束 + 上报条件 + 预估成本。
 */

export interface AcceptanceCriterion {
  readonly id: string;
  readonly description: string;
  readonly verificationMethod: 'automated' | 'human-review' | 'metric-threshold';
  readonly threshold?: number;
}

export interface TaskConstraint {
  readonly type: 'time' | 'cost' | 'quality' | 'scope' | 'dependency';
  readonly description: string;
  readonly value: string | number;
}

export interface EscalationCondition {
  readonly trigger:
    | 'timeout'
    | 'failure-count'
    | 'confidence-drop'
    | 'cost-overrun'
    | 'dependency-blocked';
  readonly threshold: number;
  readonly action: 'retry' | 'degrade' | 'swap-agent' | 'escalate-human';
}

export interface TaskContractProps {
  id: string;
  objective: string;
  inputs: readonly string[];
  acceptanceCriteria: readonly AcceptanceCriterion[];
  constraints: readonly TaskConstraint[];
  escalationConditions: readonly EscalationCondition[];
  estimatedCostTokens: number;
  estimatedDurationMs: number;
  publishedIntents: readonly string[];
  createdAt: number;
}

export class TaskContract {
  readonly id: string;
  readonly objective: string;
  readonly inputs: readonly string[];
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  readonly constraints: readonly TaskConstraint[];
  readonly escalationConditions: readonly EscalationCondition[];
  readonly estimatedCostTokens: number;
  readonly estimatedDurationMs: number;
  readonly publishedIntents: readonly string[];
  readonly createdAt: number;

  private constructor(props: TaskContractProps) {
    this.id = props.id;
    this.objective = props.objective;
    this.inputs = props.inputs;
    this.acceptanceCriteria = props.acceptanceCriteria;
    this.constraints = props.constraints;
    this.escalationConditions = props.escalationConditions;
    this.estimatedCostTokens = props.estimatedCostTokens;
    this.estimatedDurationMs = props.estimatedDurationMs;
    this.publishedIntents = props.publishedIntents;
    this.createdAt = props.createdAt;
  }

  static create(props: Omit<TaskContractProps, 'id' | 'createdAt'>): TaskContract {
    return new TaskContract({
      ...props,
      id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    });
  }

  static fromProps(props: TaskContractProps): TaskContract {
    return new TaskContract(props);
  }

  get timeConstraint(): TaskConstraint | undefined {
    return this.constraints.find((c) => c.type === 'time');
  }

  get costConstraint(): TaskConstraint | undefined {
    return this.constraints.find((c) => c.type === 'cost');
  }

  get escalationForTimeout(): EscalationCondition | undefined {
    return this.escalationConditions.find((c) => c.trigger === 'timeout');
  }

  get escalationForFailure(): EscalationCondition | undefined {
    return this.escalationConditions.find((c) => c.trigger === 'failure-count');
  }

  hasAcceptanceCriteria(): boolean {
    return this.acceptanceCriteria.length > 0;
  }

  canAutoVerify(): boolean {
    return this.acceptanceCriteria.every(
      (c) => c.verificationMethod === 'automated' || c.verificationMethod === 'metric-threshold'
    );
  }
}
