/**
 * ExecutionObjective — L2 执行目标
 *
 * 承接 L1 的具体执行任务目标：
 * taskContractId + linkedAgentId + linkedL1Id + performanceMetrics
 */

export interface PerformanceMetrics {
  readonly completionRate: number;
  readonly acceptanceRate: number;
  readonly avgDurationMs: number;
  readonly tokensCost: number;
}

export interface ExecutionObjectiveProps {
  id: string;
  l1Id: string;
  taskContractId: string;
  linkedAgentId: string;
  description: string;
  performanceMetrics: PerformanceMetrics;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}

export class ExecutionObjective {
  readonly id: string;
  readonly l1Id: string;
  readonly taskContractId: string;
  readonly linkedAgentId: string;
  readonly description: string;
  readonly performanceMetrics: PerformanceMetrics;
  readonly status: ExecutionObjectiveProps['status'];
  readonly createdAt: number;
  readonly updatedAt: number;

  private constructor(props: ExecutionObjectiveProps) {
    this.id = props.id;
    this.l1Id = props.l1Id;
    this.taskContractId = props.taskContractId;
    this.linkedAgentId = props.linkedAgentId;
    this.description = props.description;
    this.performanceMetrics = props.performanceMetrics;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: {
    l1Id: string;
    taskContractId: string;
    linkedAgentId: string;
    description: string;
  }): ExecutionObjective {
    const now = Date.now();
    return new ExecutionObjective({
      id: `l2-${now}-${Math.random().toString(36).slice(2, 7)}`,
      l1Id: props.l1Id,
      taskContractId: props.taskContractId,
      linkedAgentId: props.linkedAgentId,
      description: props.description,
      performanceMetrics: { completionRate: 0, acceptanceRate: 0, avgDurationMs: 0, tokensCost: 0 },
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: ExecutionObjectiveProps): ExecutionObjective {
    return new ExecutionObjective(props);
  }

  start(): ExecutionObjective {
    return new ExecutionObjective({
      ...this.toProps(),
      status: 'in-progress',
      updatedAt: Date.now(),
    });
  }

  complete(metrics: Partial<PerformanceMetrics>): ExecutionObjective {
    return new ExecutionObjective({
      ...this.toProps(),
      status: 'completed',
      performanceMetrics: { ...this.performanceMetrics, ...metrics },
      updatedAt: Date.now(),
    });
  }

  fail(): ExecutionObjective {
    return new ExecutionObjective({ ...this.toProps(), status: 'failed', updatedAt: Date.now() });
  }

  updateMetrics(metrics: Partial<PerformanceMetrics>): ExecutionObjective {
    return new ExecutionObjective({
      ...this.toProps(),
      performanceMetrics: { ...this.performanceMetrics, ...metrics },
      updatedAt: Date.now(),
    });
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isFailed(): boolean {
    return this.status === 'failed';
  }

  private toProps(): ExecutionObjectiveProps {
    return {
      id: this.id,
      l1Id: this.l1Id,
      taskContractId: this.taskContractId,
      linkedAgentId: this.linkedAgentId,
      description: this.description,
      performanceMetrics: { ...this.performanceMetrics },
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
