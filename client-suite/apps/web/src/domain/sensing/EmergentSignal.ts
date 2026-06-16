/**
 * EmergentSignal — 涌现信号实体
 *
 * 由 PatternDetector 生成，表示系统级别的涌现事件。
 */

export interface EmergentSignalProps {
  id: string;
  patternId: string;
  correlatedSignalIds: string[];
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
  status: 'detected' | 'acknowledged' | 'resolved' | 'dismissed';
  detectedAt: number;
  resolvedAt?: number;
}

export class EmergentSignal {
  readonly id: string;
  readonly patternId: string;
  readonly correlatedSignalIds: readonly string[];
  readonly pattern: string;
  readonly severity: EmergentSignalProps['severity'];
  readonly suggestedAction: string;
  readonly status: EmergentSignalProps['status'];
  readonly detectedAt: number;
  readonly resolvedAt?: number;

  private constructor(props: EmergentSignalProps) {
    this.id = props.id;
    this.patternId = props.patternId;
    this.correlatedSignalIds = props.correlatedSignalIds;
    this.pattern = props.pattern;
    this.severity = props.severity;
    this.suggestedAction = props.suggestedAction;
    this.status = props.status;
    this.detectedAt = props.detectedAt;
    this.resolvedAt = props.resolvedAt;
  }

  static create(props: Omit<EmergentSignalProps, 'id' | 'status' | 'detectedAt'>): EmergentSignal {
    return new EmergentSignal({
      ...props,
      id: `emg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'detected',
      detectedAt: Date.now(),
    });
  }

  acknowledge(): EmergentSignal {
    return new EmergentSignal({ ...this.toProps(), status: 'acknowledged' });
  }

  resolve(): EmergentSignal {
    return new EmergentSignal({ ...this.toProps(), status: 'resolved', resolvedAt: Date.now() });
  }

  dismiss(): EmergentSignal {
    return new EmergentSignal({ ...this.toProps(), status: 'dismissed', resolvedAt: Date.now() });
  }

  get isActive(): boolean {
    return this.status === 'detected' || this.status === 'acknowledged';
  }

  get correlatedCount(): number {
    return this.correlatedSignalIds.length;
  }

  private toProps(): EmergentSignalProps {
    return {
      id: this.id,
      patternId: this.patternId,
      correlatedSignalIds: [...this.correlatedSignalIds],
      pattern: this.pattern,
      severity: this.severity,
      suggestedAction: this.suggestedAction,
      status: this.status,
      detectedAt: this.detectedAt,
      resolvedAt: this.resolvedAt,
    };
  }
}
