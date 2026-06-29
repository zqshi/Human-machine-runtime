/**
 * EvaluationMetric — 评估指标领域实体（v2.1 EAOS 评估子系统）。
 *
 * 人机双轨（dual-track）评估的基础数据点：dimension 区分 human/agent 轨，score 为打分。
 * 对标后端 evaluation.ts 现有 route 字段（实现态契约），非前端设计态超前实体
 * （cockpitApiAdapter 无 evaluation DTO，守 Phase B/E10/E11 教训 §6.3）。
 *
 * immutable DDD：private constructor + static create/fromProps/rehydrate + toProps。
 * 不变式：dimension 限定枚举 human|agent（fromProps 校验脏数据拒建；rehydrate 容错 fallback human）；
 * score >= 0（clamp，非数字当 0）；metadata jsonb 透传 body 剩余字段（route 无完整固定契约，不强加列）。
 * avgOf 静态方法：dual-track summary 聚合算均分（round(sum/length)，空→0）。
 * 零外部依赖（守 §1.1 domain 纪律）。
 */

export type EvaluationDimension = 'human' | 'agent';

const DIMENSIONS: readonly EvaluationDimension[] = ['human', 'agent'];

function asDimension(value: string): EvaluationDimension {
  if (!DIMENSIONS.includes(value as EvaluationDimension)) {
    throw new Error(`invalid dimension "${value}", expected one of ${DIMENSIONS.join('|')}`);
  }
  return value as EvaluationDimension;
}

function coerceDimension(value: unknown, fallback: EvaluationDimension): EvaluationDimension {
  return typeof value === 'string' && (DIMENSIONS as readonly string[]).includes(value)
    ? (value as EvaluationDimension)
    : fallback;
}

/** score clamp：非数字/负数当 0，否则向下取整。 */
function clampScore(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** 规整 metadata：非对象返回 {}。 */
function normalizeMetadata(input: unknown): Record<string, unknown> {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

export interface EvaluationMetricProps {
  id: string;
  dimension: EvaluationDimension;
  score: number;
  metadata: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEvaluationMetricInput {
  id?: string;
  dimension?: EvaluationDimension;
  score?: number;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

export class EvaluationMetric {
  readonly id: string;
  readonly dimension: EvaluationDimension;
  readonly score: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly tenantId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: EvaluationMetricProps) {
    this.id = props.id;
    this.dimension = props.dimension;
    this.score = props.score;
    this.metadata = props.metadata;
    this.tenantId = props.tenantId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** 工厂：新建 metric（默认 dimension=human / score=0 / metadata 空 / 时间戳 now）。 */
  static create(input: CreateEvaluationMetricInput): EvaluationMetric {
    const now = new Date();
    return new EvaluationMetric({
      id: input.id ?? `evm-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      dimension: input.dimension ? asDimension(input.dimension) : 'human',
      score: clampScore(input.score),
      metadata: normalizeMetadata(input.metadata),
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** DB 重建：校验 dimension 不变式，脏数据拒建；score/metadata 规整。 */
  static fromProps(props: EvaluationMetricProps): EvaluationMetric {
    return new EvaluationMetric({
      id: props.id,
      dimension: asDimension(props.dimension),
      score: clampScore(props.score),
      metadata: normalizeMetadata(props.metadata),
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /** DB 脏数据容错重建（EAV 迁移旧数据可能含非法 dimension）：枚举落白名单返回原值，否则 fallback human。 */
  static rehydrate(props: {
    id: string;
    dimension: unknown;
    score: unknown;
    metadata: unknown;
    tenantId?: string;
    createdAt: Date;
    updatedAt: Date;
  }): EvaluationMetric {
    return new EvaluationMetric({
      id: props.id,
      dimension: coerceDimension(props.dimension, 'human'),
      score: clampScore(props.score),
      metadata: normalizeMetadata(props.metadata),
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * dual-track summary 聚合：算均分（round(sum/length)，空→0）。
   * 用于 dual-track 的 humanTrack/agentTrack summary.avgScore（替代原 route 内联 avg）。
   */
  static avgOf(metrics: readonly EvaluationMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((s, m) => s + m.score, 0);
    return Math.round(sum / metrics.length);
  }

  get isHumanTrack(): boolean {
    return this.dimension === 'human';
  }
  get isAgentTrack(): boolean {
    return this.dimension === 'agent';
  }

  /** 序列化（repository 写 DB / route 序列化用）。 */
  toProps(): EvaluationMetricProps {
    return {
      id: this.id,
      dimension: this.dimension,
      score: this.score,
      metadata: { ...this.metadata },
      tenantId: this.tenantId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
