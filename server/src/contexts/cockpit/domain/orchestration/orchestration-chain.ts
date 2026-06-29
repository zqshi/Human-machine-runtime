/**
 * OrchestrationChain — 编排链领域实体（v2.1 EAOS 编排子系统）。
 *
 * 表示多步骤任务推进链：advance 推进 currentStep，末步 status=completed。
 * 对标后端 orchestration.ts 现有 route 字段（实现态契约），非前端 CollaborationChain
 * 设计态超前实体（不建 nodes/edges，守 Phase B/E10 教训 §6.3）。
 *
 * immutable DDD：private constructor + static create/fromProps + advance 返回新实例。
 * 不变式：currentStep >= 0（clamp）；status 限定枚举（fromProps 校验脏数据拒建）；steps 默认 []。
 * steps 是 jsonb 透传数组（route 无固定元素契约，domain 只校验 isArray，元素形状不约束——
 * advance 只用 steps.length，不访问元素内容，诚实反映 route 现状）。
 *
 * advance 是诚实假推进（手动 currentStep++，不调度 Agent），真调度接 /agent/dispatch 留 [PLANNED]。
 * 零外部依赖（守 §1.1 domain 纪律）。
 */

export type OrchestrationChainStatus = 'active' | 'completed' | 'paused' | 'failed';

/** steps 数组元素：route body 透传，无固定契约，domain 不约束形状（Record 透传）。 */
export type OrchestrationStep = Record<string, unknown>;

const STATUSES: readonly OrchestrationChainStatus[] = ['active', 'completed', 'paused', 'failed'];

function asStatus(value: string): OrchestrationChainStatus {
  if (!STATUSES.includes(value as OrchestrationChainStatus)) {
    throw new Error(`invalid status "${value}", expected one of ${STATUSES.join('|')}`);
  }
  return value as OrchestrationChainStatus;
}

function coerceStatus(
  value: unknown,
  fallback: OrchestrationChainStatus
): OrchestrationChainStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
    ? (value as OrchestrationChainStatus)
    : fallback;
}

function clampNonNegative(n: number): number {
  return Math.max(0, Math.floor(n));
}

/** 规整 steps：非数组返回 []（route body 透传，只校验 isArray）。 */
function normalizeSteps(input: unknown): OrchestrationStep[] {
  if (!Array.isArray(input)) return [];
  return input as OrchestrationStep[];
}

export interface OrchestrationChainProps {
  id: string;
  name?: string;
  steps: OrchestrationStep[];
  currentStep: number;
  status: OrchestrationChainStatus;
  agentId?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrchestrationChainInput {
  id?: string;
  name?: string;
  steps?: OrchestrationStep[];
  currentStep?: number;
  status?: OrchestrationChainStatus;
  agentId?: string;
  tenantId?: string;
}

export class OrchestrationChain {
  readonly id: string;
  readonly name?: string;
  readonly steps: readonly OrchestrationStep[];
  readonly currentStep: number;
  readonly status: OrchestrationChainStatus;
  readonly agentId?: string;
  readonly tenantId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: OrchestrationChainProps) {
    this.id = props.id;
    this.name = props.name;
    this.steps = props.steps;
    this.currentStep = props.currentStep;
    this.status = props.status;
    this.agentId = props.agentId;
    this.tenantId = props.tenantId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** 工厂：新建 chain（默认 status=active / currentStep=0 / steps 空 / 时间戳 now）。 */
  static create(input: CreateOrchestrationChainInput): OrchestrationChain {
    const now = new Date();
    return new OrchestrationChain({
      id: input.id ?? `orch-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      name: input.name,
      steps: normalizeSteps(input.steps),
      currentStep: clampNonNegative(input.currentStep ?? 0),
      status: input.status ? asStatus(input.status) : 'active',
      agentId: input.agentId,
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** DB 重建：校验 status 不变式，脏数据拒建；steps/currentStep 规整。 */
  static fromProps(props: OrchestrationChainProps): OrchestrationChain {
    return new OrchestrationChain({
      id: props.id,
      name: props.name,
      steps: normalizeSteps(props.steps),
      currentStep: clampNonNegative(props.currentStep),
      status: asStatus(props.status),
      agentId: props.agentId,
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /** DB 脏数据容错重建（EAV 迁移旧数据可能含非法 status）：枚举落白名单返回原值，否则 fallback。 */
  static rehydrate(props: {
    id: string;
    name?: string;
    steps: unknown;
    currentStep: number;
    status: unknown;
    agentId?: string;
    tenantId?: string;
    createdAt: Date;
    updatedAt: Date;
  }): OrchestrationChain {
    return new OrchestrationChain({
      id: props.id,
      name: props.name,
      steps: normalizeSteps(props.steps),
      currentStep: clampNonNegative(props.currentStep),
      status: coerceStatus(props.status, 'active'),
      agentId: props.agentId,
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * advance 状态机：currentStep++，若 nextStep >= steps.length 则 status=completed。
   * 返回新实例（updatedAt 刷新），原实例 immutable。
   * 诚实标注：手动 currentStep++，不调度 Agent（[PLANNED] 接 /agent/dispatch 真调度）。
   */
  advance(): OrchestrationChain {
    const nextStep = this.currentStep + 1;
    const completed = nextStep >= this.steps.length;
    return new OrchestrationChain({
      ...this.toProps(),
      currentStep: nextStep,
      status: completed ? 'completed' : this.status,
      updatedAt: new Date(),
    });
  }

  get isActive(): boolean {
    return this.status === 'active';
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  /** 序列化（repository 写 DB / route 序列化用）。 */
  toProps(): OrchestrationChainProps {
    return {
      id: this.id,
      name: this.name,
      steps: [...this.steps],
      currentStep: this.currentStep,
      status: this.status,
      agentId: this.agentId,
      tenantId: this.tenantId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
