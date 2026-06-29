/**
 * OrchestrationAgent — 编排 Agent 注册记录领域实体（v2.1 EAOS 编排子系统）。
 *
 * 表示接入编排链的 Agent 注册记录。对标后端 orchestration.ts 现有 route 字段（实现态契约），
 * route 仅 POST 注册（无 PATCH 端点），故无状态机（仅注册记录，状态机留 [PLANNED]）——
 * 诚实反映各端点现状（chain/escalation 有状态机，agent 无）。
 *
 * immutable DDD：private constructor + static create/fromProps/rehydrate。
 * 不变式：registeredAt 必填；status 限定枚举（fromProps 校验脏数据拒建；rehydrate 容错）；
 * metadata jsonb 透传 body 剩余字段（route 无完整固定契约，不强加列）。
 * 零外部依赖（守 §1.1 domain 纪律）。
 */

export type OrchestrationAgentStatus = 'registered' | 'active' | 'idle' | 'offline';

const STATUSES: readonly OrchestrationAgentStatus[] = ['registered', 'active', 'idle', 'offline'];

function asStatus(value: string): OrchestrationAgentStatus {
  if (!STATUSES.includes(value as OrchestrationAgentStatus)) {
    throw new Error(`invalid status "${value}", expected one of ${STATUSES.join('|')}`);
  }
  return value as OrchestrationAgentStatus;
}

function coerceStatus(
  value: unknown,
  fallback: OrchestrationAgentStatus
): OrchestrationAgentStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
    ? (value as OrchestrationAgentStatus)
    : fallback;
}

/** 规整 metadata：非对象返回 {}。 */
function normalizeMetadata(input: unknown): Record<string, unknown> {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

export interface OrchestrationAgentProps {
  id: string;
  agentId?: string;
  role?: string;
  status: OrchestrationAgentStatus;
  metadata: Record<string, unknown>;
  tenantId?: string;
  registeredAt: Date;
}

export interface CreateOrchestrationAgentInput {
  id?: string;
  agentId?: string;
  role?: string;
  status?: OrchestrationAgentStatus;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  registeredAt?: Date;
}

export class OrchestrationAgent {
  readonly id: string;
  readonly agentId?: string;
  readonly role?: string;
  readonly status: OrchestrationAgentStatus;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly tenantId?: string;
  readonly registeredAt: Date;

  private constructor(props: OrchestrationAgentProps) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.role = props.role;
    this.status = props.status;
    this.metadata = props.metadata;
    this.tenantId = props.tenantId;
    this.registeredAt = props.registeredAt;
  }

  /** 工厂：新建 agent 注册（默认 status=registered / metadata 空 / registeredAt now）。 */
  static create(input: CreateOrchestrationAgentInput): OrchestrationAgent {
    return new OrchestrationAgent({
      id: input.id ?? `oag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      agentId: input.agentId,
      role: input.role,
      status: input.status ? asStatus(input.status) : 'registered',
      metadata: normalizeMetadata(input.metadata),
      tenantId: input.tenantId,
      registeredAt: input.registeredAt ?? new Date(),
    });
  }

  /** DB 重建：校验 status 不变式，脏数据拒建；metadata 规整。 */
  static fromProps(props: OrchestrationAgentProps): OrchestrationAgent {
    return new OrchestrationAgent({
      id: props.id,
      agentId: props.agentId,
      role: props.role,
      status: asStatus(props.status),
      metadata: normalizeMetadata(props.metadata),
      tenantId: props.tenantId,
      registeredAt: props.registeredAt,
    });
  }

  /** DB 脏数据容错重建（EAV 迁移旧数据可能含非法 status）：枚举落白名单返回原值，否则 fallback registered。 */
  static rehydrate(props: {
    id: string;
    agentId?: string;
    role?: string;
    status: unknown;
    metadata: unknown;
    tenantId?: string;
    registeredAt: Date;
  }): OrchestrationAgent {
    return new OrchestrationAgent({
      id: props.id,
      agentId: props.agentId,
      role: props.role,
      status: coerceStatus(props.status, 'registered'),
      metadata: normalizeMetadata(props.metadata),
      tenantId: props.tenantId,
      registeredAt: props.registeredAt,
    });
  }

  get isRegistered(): boolean {
    return this.status === 'registered';
  }
  get isActive(): boolean {
    return this.status === 'active';
  }

  /** 序列化（repository 写 DB / route 序列化用）。 */
  toProps(): OrchestrationAgentProps {
    return {
      id: this.id,
      agentId: this.agentId,
      role: this.role,
      status: this.status,
      metadata: { ...this.metadata },
      tenantId: this.tenantId,
      registeredAt: this.registeredAt,
    };
  }
}
