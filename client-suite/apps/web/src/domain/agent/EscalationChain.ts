/**
 * EscalationChain — 异常升级链
 *
 * 标准化升级路径：retry → degrade → swap-agent → escalate to human。
 * 每个 stage 有最大重试次数和超时。
 */

export type EscalationStage = 'retry' | 'degrade' | 'swap-agent' | 'escalate-human';
export type EscalationChainStatus = 'idle' | 'active' | 'resolved' | 'escalated-to-human';

export interface StageConfig {
  readonly stage: EscalationStage;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly degradeStrategy?: string;
  readonly swapCandidateIds?: readonly string[];
}

export interface StageAttempt {
  readonly stage: EscalationStage;
  readonly attemptNumber: number;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly success: boolean;
  readonly error?: string;
}

export interface EscalationChainProps {
  id: string;
  taskId: string;
  status: EscalationChainStatus;
  stages: StageConfig[];
  currentStageIndex: number;
  currentAttempt: number;
  attempts: StageAttempt[];
  triggeredAt: number;
  resolvedAt?: number;
  resolution?: string;
}

export class EscalationChain {
  readonly id: string;
  readonly taskId: string;
  readonly status: EscalationChainStatus;
  readonly stages: readonly StageConfig[];
  readonly currentStageIndex: number;
  readonly currentAttempt: number;
  readonly attempts: readonly StageAttempt[];
  readonly triggeredAt: number;
  readonly resolvedAt?: number;
  readonly resolution?: string;

  private constructor(props: EscalationChainProps) {
    this.id = props.id;
    this.taskId = props.taskId;
    this.status = props.status;
    this.stages = props.stages;
    this.currentStageIndex = props.currentStageIndex;
    this.currentAttempt = props.currentAttempt;
    this.attempts = props.attempts;
    this.triggeredAt = props.triggeredAt;
    this.resolvedAt = props.resolvedAt;
    this.resolution = props.resolution;
  }

  static createDefault(taskId: string): EscalationChain {
    return new EscalationChain({
      id: `esc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId,
      status: 'idle',
      stages: [
        { stage: 'retry', maxAttempts: 3, timeoutMs: 30_000 },
        { stage: 'degrade', maxAttempts: 1, timeoutMs: 60_000, degradeStrategy: 'reduce-scope' },
        { stage: 'swap-agent', maxAttempts: 2, timeoutMs: 120_000 },
        { stage: 'escalate-human', maxAttempts: 1, timeoutMs: 3_600_000 },
      ],
      currentStageIndex: 0,
      currentAttempt: 0,
      attempts: [],
      triggeredAt: Date.now(),
    });
  }

  static create(taskId: string, stages: StageConfig[]): EscalationChain {
    return new EscalationChain({
      id: `esc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId,
      status: 'idle',
      stages,
      currentStageIndex: 0,
      currentAttempt: 0,
      attempts: [],
      triggeredAt: Date.now(),
    });
  }

  trigger(): EscalationChain {
    if (this.status !== 'idle') return this;
    return new EscalationChain({
      ...this.toProps(),
      status: 'active',
      triggeredAt: Date.now(),
    });
  }

  recordAttempt(success: boolean, error?: string): EscalationChain {
    if (this.status !== 'active') return this;

    const stage = this.currentStage;
    if (!stage) return this;

    const attempt: StageAttempt = {
      stage: stage.stage,
      attemptNumber: this.currentAttempt + 1,
      startedAt: Date.now(),
      completedAt: Date.now(),
      success,
      error,
    };

    if (success) {
      return new EscalationChain({
        ...this.toProps(),
        status: 'resolved',
        attempts: [...this.attempts, attempt],
        resolvedAt: Date.now(),
        resolution: `Resolved at stage: ${stage.stage}`,
      });
    }

    const nextAttempt = this.currentAttempt + 1;
    if (nextAttempt < stage.maxAttempts) {
      return new EscalationChain({
        ...this.toProps(),
        currentAttempt: nextAttempt,
        attempts: [...this.attempts, attempt],
      });
    }

    const nextStageIndex = this.currentStageIndex + 1;
    if (nextStageIndex >= this.stages.length) {
      return new EscalationChain({
        ...this.toProps(),
        status: 'escalated-to-human',
        attempts: [...this.attempts, attempt],
        resolvedAt: Date.now(),
        resolution: 'All stages exhausted — escalated to human',
      });
    }

    return new EscalationChain({
      ...this.toProps(),
      currentStageIndex: nextStageIndex,
      currentAttempt: 0,
      attempts: [...this.attempts, attempt],
    });
  }

  resolve(resolution: string): EscalationChain {
    return new EscalationChain({
      ...this.toProps(),
      status: 'resolved',
      resolvedAt: Date.now(),
      resolution,
    });
  }

  get currentStage(): StageConfig | undefined {
    return this.stages[this.currentStageIndex];
  }

  get isActive(): boolean {
    return this.status === 'active';
  }

  get isResolved(): boolean {
    return this.status === 'resolved';
  }

  get isEscalatedToHuman(): boolean {
    return this.status === 'escalated-to-human';
  }

  get totalAttempts(): number {
    return this.attempts.length;
  }

  get progressPercent(): number {
    if (this.stages.length === 0) return 0;
    return Math.round((this.currentStageIndex / this.stages.length) * 100);
  }

  private toProps(): EscalationChainProps {
    return {
      id: this.id,
      taskId: this.taskId,
      status: this.status,
      stages: [...this.stages],
      currentStageIndex: this.currentStageIndex,
      currentAttempt: this.currentAttempt,
      attempts: [...this.attempts],
      triggeredAt: this.triggeredAt,
      resolvedAt: this.resolvedAt,
      resolution: this.resolution,
    };
  }
}
