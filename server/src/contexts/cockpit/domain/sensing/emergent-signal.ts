/**
 * EmergentSignal — 涌现信号领域实体（v2.1 EAOS 感知子系统，对标前端 client-suite domain/sensing/EmergentSignal）。
 *
 * immutable DDD 风格：private constructor + static create/fromProps + 状态转换返回新实例。
 * 不变式：severity/status 限定枚举（fromProps 校验，DB 脏数据拒建）；acknowledge 仅 detected→acknowledged。
 * 涌现信号来源：④dispatch trace 异常检测自动提取（SignalExtractionService）或人工录入。
 * 零外部依赖（守 §1.1 domain 纪律，不 import application/adapters/routes/infrastructure）。
 */

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SignalStatus = 'detected' | 'acknowledged' | 'resolved' | 'dismissed';

const SEVERITIES: readonly SignalSeverity[] = ['low', 'medium', 'high', 'critical'];
const STATUSES: readonly SignalStatus[] = ['detected', 'acknowledged', 'resolved', 'dismissed'];

export interface EmergentSignalProps {
  id: string;
  patternId?: string;
  correlatedSignalIds: string[];
  pattern: string;
  severity: SignalSeverity;
  suggestedAction?: string;
  status: SignalStatus;
  /** 检测时间 epoch ms */
  detectedAt: number;
  /** 解决时间 epoch ms（resolved/dismissed 时设） */
  resolvedAt?: number;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

function asSeverity(value: string): SignalSeverity {
  if (!SEVERITIES.includes(value as SignalSeverity)) {
    throw new Error(`invalid severity "${value}", expected one of ${SEVERITIES.join('|')}`);
  }
  return value as SignalSeverity;
}

function asStatus(value: string): SignalStatus {
  if (!STATUSES.includes(value as SignalStatus)) {
    throw new Error(`invalid status "${value}", expected one of ${STATUSES.join('|')}`);
  }
  return value as SignalStatus;
}

export class EmergentSignal {
  readonly id: string;
  readonly patternId?: string;
  readonly correlatedSignalIds: readonly string[];
  readonly pattern: string;
  readonly severity: SignalSeverity;
  readonly suggestedAction?: string;
  readonly status: SignalStatus;
  readonly detectedAt: number;
  readonly resolvedAt?: number;
  readonly tenantId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

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
    this.tenantId = props.tenantId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** 工厂：新建 detected 信号（id/状态/时间戳自动）。 */
  static create(props: {
    pattern: string;
    severity: SignalSeverity;
    patternId?: string;
    correlatedSignalIds?: string[];
    suggestedAction?: string;
    tenantId?: string;
    detectedAt?: number;
  }): EmergentSignal {
    const now = new Date();
    return new EmergentSignal({
      id: `emg-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      patternId: props.patternId,
      correlatedSignalIds: props.correlatedSignalIds ?? [],
      pattern: props.pattern,
      severity: asSeverity(props.severity),
      suggestedAction: props.suggestedAction,
      status: 'detected',
      detectedAt: props.detectedAt ?? now.getTime(),
      tenantId: props.tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** DB 重建：从持久化 props 重建实体（校验枚举不变式，脏数据拒建）。 */
  static fromProps(props: EmergentSignalProps): EmergentSignal {
    return new EmergentSignal({
      id: props.id,
      patternId: props.patternId,
      correlatedSignalIds: props.correlatedSignalIds ?? [],
      pattern: props.pattern,
      severity: asSeverity(props.severity),
      suggestedAction: props.suggestedAction,
      status: asStatus(props.status),
      detectedAt: props.detectedAt,
      resolvedAt: props.resolvedAt,
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /** 状态机：detected → acknowledged（人已看到）。非法转换抛错。 */
  acknowledge(): EmergentSignal {
    if (this.status !== 'detected') {
      throw new Error(`cannot acknowledge signal in status "${this.status}" (only detected)`);
    }
    return new EmergentSignal({ ...this.toProps(), status: 'acknowledged', updatedAt: new Date() });
  }

  /** 状态机：→ resolved（已解决）。设 resolvedAt。 */
  resolve(): EmergentSignal {
    if (this.status === 'resolved' || this.status === 'dismissed') {
      throw new Error(`cannot resolve signal already in terminal status "${this.status}"`);
    }
    const now = new Date();
    return new EmergentSignal({
      ...this.toProps(),
      status: 'resolved',
      resolvedAt: now.getTime(),
      updatedAt: now,
    });
  }

  /** 状态机：→ dismissed（忽略）。设 resolvedAt。 */
  dismiss(): EmergentSignal {
    if (this.status === 'resolved' || this.status === 'dismissed') {
      throw new Error(`cannot dismiss signal already in terminal status "${this.status}"`);
    }
    const now = new Date();
    return new EmergentSignal({
      ...this.toProps(),
      status: 'dismissed',
      resolvedAt: now.getTime(),
      updatedAt: now,
    });
  }

  /** 是否仍需关注（detected/acknowledged，未终结）。 */
  get isActive(): boolean {
    return this.status === 'detected' || this.status === 'acknowledged';
  }

  /** 关联信号数。 */
  get correlatedCount(): number {
    return this.correlatedSignalIds.length;
  }

  /** 是否高严重度（需优先处理）。 */
  get isHighSeverity(): boolean {
    return this.severity === 'high' || this.severity === 'critical';
  }

  /** 序列化（repository 写 DB 用）。 */
  toProps(): EmergentSignalProps {
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
      tenantId: this.tenantId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
