/**
 * PushPolicy — 推送策略域模型
 *
 * 定义不同紧急度的信号通过哪些通道推送，
 * 支持用户自定义静默时段和通道偏好。
 */

import type { SignalUrgency } from './Signal';

export type PushChannel = 'toast' | 'sound' | 'floating' | 'desktop' | 'badge';

export interface ChannelConfig {
  readonly enabled: boolean;
  readonly batchWindowMs?: number;
}

export type PushMatrix = Record<SignalUrgency, PushChannel[]>;

export interface QuietHours {
  readonly enabled: boolean;
  readonly startHour: number;
  readonly endHour: number;
  readonly overrideForCritical: boolean;
}

export interface PushPolicyProps {
  matrix: PushMatrix;
  quietHours: QuietHours;
  batchWindowMs: number;
}

const DEFAULT_MATRIX: PushMatrix = {
  critical: ['toast', 'sound', 'floating', 'desktop'],
  high: ['toast', 'floating'],
  normal: ['badge'],
  low: ['badge'],
};

const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startHour: 22,
  endHour: 8,
  overrideForCritical: true,
};

export class PushPolicy {
  readonly matrix: PushMatrix;
  readonly quietHours: QuietHours;
  readonly batchWindowMs: number;

  private constructor(props: PushPolicyProps) {
    this.matrix = props.matrix;
    this.quietHours = props.quietHours;
    this.batchWindowMs = props.batchWindowMs;
  }

  static createDefault(): PushPolicy {
    return new PushPolicy({
      matrix: DEFAULT_MATRIX,
      quietHours: DEFAULT_QUIET_HOURS,
      batchWindowMs: 5000,
    });
  }

  static fromProps(props: PushPolicyProps): PushPolicy {
    return new PushPolicy(props);
  }

  getChannels(urgency: SignalUrgency, now: Date = new Date()): PushChannel[] {
    if (
      this.isInQuietHours(now) &&
      !(urgency === 'critical' && this.quietHours.overrideForCritical)
    ) {
      return [];
    }
    return this.matrix[urgency];
  }

  isInQuietHours(now: Date = new Date()): boolean {
    if (!this.quietHours.enabled) return false;
    const hour = now.getHours();
    const { startHour, endHour } = this.quietHours;

    if (startHour > endHour) {
      return hour >= startHour || hour < endHour;
    }
    return hour >= startHour && hour < endHour;
  }

  shouldBatch(urgency: SignalUrgency): boolean {
    return urgency !== 'critical';
  }

  withMatrix(matrix: Partial<PushMatrix>): PushPolicy {
    return new PushPolicy({
      matrix: { ...this.matrix, ...matrix },
      quietHours: this.quietHours,
      batchWindowMs: this.batchWindowMs,
    });
  }

  withQuietHours(quietHours: Partial<QuietHours>): PushPolicy {
    return new PushPolicy({
      matrix: this.matrix,
      quietHours: { ...this.quietHours, ...quietHours },
      batchWindowMs: this.batchWindowMs,
    });
  }

  withBatchWindow(ms: number): PushPolicy {
    return new PushPolicy({
      matrix: this.matrix,
      quietHours: this.quietHours,
      batchWindowMs: ms,
    });
  }

  toProps(): PushPolicyProps {
    return {
      matrix: this.matrix,
      quietHours: this.quietHours,
      batchWindowMs: this.batchWindowMs,
    };
  }
}
