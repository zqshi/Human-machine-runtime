/**
 * Objective — 战略目标领域实体（v2.1 EAOS 战略解码子系统，对标前端 ObjectiveDTO 扁平统一结构）。
 *
 * immutable DDD 风格：private constructor + static create/fromProps + 状态转换返回新实例。
 * 不变式：level/status 限定枚举（fromProps 校验，DB 脏数据拒建）；confidence clamp 0-1。
 * L0/L1/L2 三级层次靠 parentId 自关联（L1→L0.id, L2→L1.id）。
 * PerformanceMetrics 值对象（对标前端 ExecutionObjective.PerformanceMetrics），率值 clamp 0-1。
 * 零外部依赖（守 §1.1 domain 纪律，不 import application/adapters/routes/infrastructure）。
 */

export type ObjectiveLevel = 'L0' | 'L1' | 'L2';
export type ObjectiveStatus = 'active' | 'completed' | 'paused' | 'abandoned';

const LEVELS: readonly ObjectiveLevel[] = ['L0', 'L1', 'L2'];
const STATUSES: readonly ObjectiveStatus[] = ['active', 'completed', 'paused', 'abandoned'];

/** PerformanceMetrics 值对象（对标前端 ExecutionObjective.PerformanceMetrics）。 */
export interface PerformanceMetrics {
  readonly completionRate: number;
  readonly acceptanceRate: number;
  readonly avgDurationMs: number;
  readonly tokensCost: number;
}

function asLevel(value: string): ObjectiveLevel {
  if (!LEVELS.includes(value as ObjectiveLevel)) {
    throw new Error(`invalid level "${value}", expected one of ${LEVELS.join('|')}`);
  }
  return value as ObjectiveLevel;
}

function asStatus(value: string): ObjectiveStatus {
  if (!STATUSES.includes(value as ObjectiveStatus)) {
    throw new Error(`invalid status "${value}", expected one of ${STATUSES.join('|')}`);
  }
  return value as ObjectiveStatus;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clampNonNegative(n: number): number {
  return Math.max(0, n);
}

/** 规整 PerformanceMetrics：率值 clamp 0-1，绝对值 >= 0，缺失字段补 0。 */
function normalizeMetrics(input: Partial<PerformanceMetrics> | undefined): PerformanceMetrics {
  return {
    completionRate: clamp01(typeof input?.completionRate === 'number' ? input.completionRate : 0),
    acceptanceRate: clamp01(typeof input?.acceptanceRate === 'number' ? input.acceptanceRate : 0),
    avgDurationMs: clampNonNegative(
      typeof input?.avgDurationMs === 'number' ? input.avgDurationMs : 0
    ),
    tokensCost: clampNonNegative(typeof input?.tokensCost === 'number' ? input.tokensCost : 0),
  };
}

export interface ObjectiveProps {
  id: string;
  level: ObjectiveLevel;
  parentId?: string;
  tenantId?: string;
  title?: string;
  description?: string;
  confidence: number;
  status: ObjectiveStatus;
  metrics: PerformanceMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateObjectiveInput {
  level: ObjectiveLevel;
  parentId?: string;
  tenantId?: string;
  title?: string;
  description?: string;
  confidence?: number;
  status?: ObjectiveStatus;
  metrics?: Partial<PerformanceMetrics>;
}

export class Objective {
  readonly id: string;
  readonly level: ObjectiveLevel;
  readonly parentId?: string;
  readonly tenantId?: string;
  readonly title?: string;
  readonly description?: string;
  readonly confidence: number;
  readonly status: ObjectiveStatus;
  readonly metrics: PerformanceMetrics;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ObjectiveProps) {
    this.id = props.id;
    this.level = props.level;
    this.parentId = props.parentId;
    this.tenantId = props.tenantId;
    this.title = props.title;
    this.description = props.description;
    this.confidence = props.confidence;
    this.status = props.status;
    this.metrics = props.metrics;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** 工厂：新建 objective（默认 status=active, confidence=0, metrics 零值, 时间戳 now）。 */
  static create(input: CreateObjectiveInput): Objective {
    const now = new Date();
    return new Objective({
      id: `obj-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      level: asLevel(input.level),
      parentId: input.parentId,
      tenantId: input.tenantId,
      title: input.title,
      description: input.description,
      confidence: clamp01(input.confidence ?? 0),
      status: input.status ? asStatus(input.status) : 'active',
      metrics: normalizeMetrics(input.metrics),
      createdAt: now,
      updatedAt: now,
    });
  }

  /** DB 重建：校验 level/status 不变式，脏数据拒建。confidence/metrics 规整。 */
  static fromProps(props: ObjectiveProps): Objective {
    return new Objective({
      id: props.id,
      level: asLevel(props.level),
      parentId: props.parentId,
      tenantId: props.tenantId,
      title: props.title,
      description: props.description,
      confidence: clamp01(props.confidence),
      status: asStatus(props.status),
      metrics: normalizeMetrics(props.metrics),
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  // ── 状态机（返回新实例，updatedAt 刷新；原实例 immutable）──

  activate(): Objective {
    return new Objective({ ...this.toProps(), status: 'active', updatedAt: new Date() });
  }

  pause(): Objective {
    return new Objective({ ...this.toProps(), status: 'paused', updatedAt: new Date() });
  }

  complete(metrics?: Partial<PerformanceMetrics>): Objective {
    return new Objective({
      ...this.toProps(),
      status: 'completed',
      metrics: metrics ? normalizeMetrics({ ...this.metrics, ...metrics }) : this.metrics,
      updatedAt: new Date(),
    });
  }

  abandon(): Objective {
    return new Objective({ ...this.toProps(), status: 'abandoned', updatedAt: new Date() });
  }

  // ── 不变式更新（confidence clamp 0-1，metrics 率值 clamp）──

  updateConfidence(score: number): Objective {
    return new Objective({
      ...this.toProps(),
      confidence: clamp01(score),
      updatedAt: new Date(),
    });
  }

  updateMetrics(patch: Partial<PerformanceMetrics>): Objective {
    return new Objective({
      ...this.toProps(),
      metrics: normalizeMetrics({ ...this.metrics, ...patch }),
      updatedAt: new Date(),
    });
  }

  // ── 派生查询 ──

  get isActive(): boolean {
    return this.status === 'active';
  }

  get isTerminal(): boolean {
    return this.status === 'completed' || this.status === 'abandoned';
  }

  /** 序列化（repository 写 DB / route 序列化用）。 */
  toProps(): ObjectiveProps {
    return {
      id: this.id,
      level: this.level,
      parentId: this.parentId,
      tenantId: this.tenantId,
      title: this.title,
      description: this.description,
      confidence: this.confidence,
      status: this.status,
      metrics: { ...this.metrics },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
