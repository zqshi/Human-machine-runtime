/**
 * Escalation — 升级记录领域实体（v2.1 EAOS 编排子系统）。
 *
 * 异常/超时触发的升级生命周期：open → acknowledged → resolved → closed（单向推进，允许跳级，禁回退）。
 * 对标后端 orchestration.ts 现有 route 字段（实现态契约），非前端 EscalationChain
 * 设计态超前实体（不建 stages/attempts/StageAttempt，守 Phase B/E10 教训 §6.3）。
 *
 * immutable DDD：private constructor + static create/fromProps/rehydrate + transition 返回新实例。
 * 不变式：status 限定枚举（fromProps 校验脏数据拒建；rehydrate 容错 fallback open）；
 * metadata jsonb 透传 body 剩余字段（route 无完整固定契约，不强加列）。
 * 零外部依赖（守 §1.1 domain 纪律）。
 */

export type EscalationStatus = 'open' | 'acknowledged' | 'resolved' | 'closed';

const STATUSES: readonly EscalationStatus[] = ['open', 'acknowledged', 'resolved', 'closed'];

/** 状态序号（用于 transition 合法性比较：newStatus 必须 >= currentStatus，禁回退）。 */
const STATUS_ORDER: Record<EscalationStatus, number> = {
  open: 0,
  acknowledged: 1,
  resolved: 2,
  closed: 3,
};

function asStatus(value: string): EscalationStatus {
  if (!STATUSES.includes(value as EscalationStatus)) {
    throw new Error(`invalid status "${value}", expected one of ${STATUSES.join('|')}`);
  }
  return value as EscalationStatus;
}

function coerceStatus(value: unknown, fallback: EscalationStatus): EscalationStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
    ? (value as EscalationStatus)
    : fallback;
}

/** 规整 metadata：非对象返回 {}。 */
function normalizeMetadata(input: unknown): Record<string, unknown> {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

export interface EscalationProps {
  id: string;
  status: EscalationStatus;
  severity?: string;
  triggerReason?: string;
  relatedTaskId?: string;
  metadata: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEscalationInput {
  id?: string;
  status?: EscalationStatus;
  severity?: string;
  triggerReason?: string;
  relatedTaskId?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

export class Escalation {
  readonly id: string;
  readonly status: EscalationStatus;
  readonly severity?: string;
  readonly triggerReason?: string;
  readonly relatedTaskId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly tenantId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: EscalationProps) {
    this.id = props.id;
    this.status = props.status;
    this.severity = props.severity;
    this.triggerReason = props.triggerReason;
    this.relatedTaskId = props.relatedTaskId;
    this.metadata = props.metadata;
    this.tenantId = props.tenantId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** 工厂：新建 escalation（默认 status=open / metadata 空 / 时间戳 now）。 */
  static create(input: CreateEscalationInput): Escalation {
    const now = new Date();
    return new Escalation({
      id: input.id ?? `esc-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      status: input.status ? asStatus(input.status) : 'open',
      severity: input.severity,
      triggerReason: input.triggerReason,
      relatedTaskId: input.relatedTaskId,
      metadata: normalizeMetadata(input.metadata),
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** DB 重建：校验 status 不变式，脏数据拒建；metadata 规整。 */
  static fromProps(props: EscalationProps): Escalation {
    return new Escalation({
      id: props.id,
      status: asStatus(props.status),
      severity: props.severity,
      triggerReason: props.triggerReason,
      relatedTaskId: props.relatedTaskId,
      metadata: normalizeMetadata(props.metadata),
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /** DB 脏数据容错重建（EAV 迁移旧数据可能含非法 status）：枚举落白名单返回原值，否则 fallback open。 */
  static rehydrate(props: {
    id: string;
    status: unknown;
    severity?: string;
    triggerReason?: string;
    relatedTaskId?: string;
    metadata: unknown;
    tenantId?: string;
    createdAt: Date;
    updatedAt: Date;
  }): Escalation {
    return new Escalation({
      id: props.id,
      status: coerceStatus(props.status, 'open'),
      severity: props.severity,
      triggerReason: props.triggerReason,
      relatedTaskId: props.relatedTaskId,
      metadata: normalizeMetadata(props.metadata),
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * transition 状态机：status 单向推进（open→acknowledged→resolved→closed），允许跳级，禁回退。
   * newStatus 序号 < currentStatus 序号 → 抛错（非法回退）。相同 status 幂等允许。
   * 返回新实例（updatedAt 刷新 + metadata 可合并 patch）。
   */
  transition(newStatus: EscalationStatus, metadataPatch?: Record<string, unknown>): Escalation {
    asStatus(newStatus); // 校验合法枚举（运行时 route 传任意 string 时拒脏值，TS 类型不挡）
    if (STATUS_ORDER[newStatus] < STATUS_ORDER[this.status]) {
      throw new Error(`invalid escalation transition: ${this.status} → ${newStatus} (回退禁止)`);
    }
    const merged =
      metadataPatch && Object.keys(metadataPatch).length > 0
        ? { ...this.metadata, ...metadataPatch }
        : this.metadata;
    return new Escalation({
      ...this.toProps(),
      status: newStatus,
      metadata: merged,
      updatedAt: new Date(),
    });
  }

  /** 便捷状态机方法。 */
  acknowledge(): Escalation {
    return this.transition('acknowledged');
  }
  resolve(metadataPatch?: Record<string, unknown>): Escalation {
    return this.transition('resolved', metadataPatch);
  }
  close(): Escalation {
    return this.transition('closed');
  }

  get isOpen(): boolean {
    return this.status === 'open';
  }
  get isResolved(): boolean {
    return this.status === 'resolved';
  }
  get isTerminal(): boolean {
    return this.status === 'closed' || this.status === 'resolved';
  }

  /** 序列化（repository 写 DB / route 序列化用）。 */
  toProps(): EscalationProps {
    return {
      id: this.id,
      status: this.status,
      severity: this.severity,
      triggerReason: this.triggerReason,
      relatedTaskId: this.relatedTaskId,
      metadata: { ...this.metadata },
      tenantId: this.tenantId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
