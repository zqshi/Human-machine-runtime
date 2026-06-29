/**
 * Scorecard — 评估记分卡领域实体（v2.1 EAOS 评估子系统）。
 *
 * 多维度打分聚合：scores 存 ScoreValue 值对象数组，overallScore 为均分。
 * 对标后端 evaluation.ts 现有 route 字段（实现态契约），非前端设计态超前实体
 * （cockpitApiAdapter 无 evaluation DTO，守 Phase B/E10/E11 教训 §6.3）。
 *
 * immutable DDD：private constructor + static create/fromProps/rehydrate + toProps。
 * 不变式：scores 为 ScoreValue[]（元素 {value:number}，非 number 当 0 防 NaN）；
 * overallScore = round(sum(value)/scores.length)（create 时计算，空→0，对齐原 route create 覆盖行为，
 * create 忽略入参 overallScore 防外部传错）；fromProps/rehydrate 信任 DB 值（只 clamp，不重算）。
 * metadata jsonb 透传 body 剩余字段（route 无完整固定契约，不强加列）。
 * 零外部依赖（守 §1.1 domain 纪律）。
 */

/** scores 数组元素：route body 透传 {value:number}，domain 规整非 number 当 0。 */
export interface ScoreValue {
  value: number;
}

/** score 值 clamp：非数字/负数当 0，否则向下取整。 */
function clampScoreValue(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * 规整 scores 数组：非数组→[]；元素非 {value:number} 当 {value:0}（防 NaN，保留占位维持分母）。
 * 不丢弃非法元素（对齐原 route 分母=scores.length 语义，避免均分失真）。
 */
function normalizeScores(input: unknown): ScoreValue[] {
  if (!Array.isArray(input)) return [];
  return input.map((raw) => {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const r = raw as Record<string, unknown>;
      return { value: clampScoreValue(r.value) };
    }
    return { value: 0 };
  });
}

/**
 * overallScore 不变式：round(sum(value)/scores.length)，空→0。
 * 对齐原 evaluation.ts route POST 的 overallScore 计算（sum/scores.length）。
 */
function computeOverallScore(scores: readonly ScoreValue[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((s, v) => s + v.value, 0);
  return Math.round(sum / scores.length);
}

/** 规整 metadata：非对象返回 {}。 */
function normalizeMetadata(input: unknown): Record<string, unknown> {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

export interface ScorecardProps {
  id: string;
  scores: ScoreValue[];
  overallScore: number;
  metadata: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScorecardInput {
  id?: string;
  scores?: unknown;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

export class Scorecard {
  readonly id: string;
  readonly scores: readonly ScoreValue[];
  readonly overallScore: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly tenantId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ScorecardProps) {
    this.id = props.id;
    this.scores = props.scores;
    this.overallScore = props.overallScore;
    this.metadata = props.metadata;
    this.tenantId = props.tenantId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * 工厂：新建 scorecard（create 时算 overallScore，忽略入参；scores 默认 [] / metadata 空 / 时间戳 now）。
   * overallScore 由 scores 计算为准（防外部传错，对齐原 route create 时覆盖行为）。
   */
  static create(input: CreateScorecardInput): Scorecard {
    const now = new Date();
    const scores = normalizeScores(input.scores);
    return new Scorecard({
      id: input.id ?? `sc-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      scores,
      overallScore: computeOverallScore(scores),
      metadata: normalizeMetadata(input.metadata),
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** DB 重建：信任 DB overallScore（只 clamp，不重算）；scores/metadata 规整。 */
  static fromProps(props: ScorecardProps): Scorecard {
    return new Scorecard({
      id: props.id,
      scores: normalizeScores(props.scores),
      overallScore: clampScoreValue(props.overallScore),
      metadata: normalizeMetadata(props.metadata),
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /** DB 脏数据容错重建（EAV 迁移旧数据可能含非法 scores/overallScore）：规整不抛错。 */
  static rehydrate(props: {
    id: string;
    scores: unknown;
    overallScore: unknown;
    metadata: unknown;
    tenantId?: string;
    createdAt: Date;
    updatedAt: Date;
  }): Scorecard {
    return new Scorecard({
      id: props.id,
      scores: normalizeScores(props.scores),
      overallScore: clampScoreValue(props.overallScore),
      metadata: normalizeMetadata(props.metadata),
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  get isEmpty(): boolean {
    return this.scores.length === 0;
  }

  /** 序列化（repository 写 DB / route 序列化用）。 */
  toProps(): ScorecardProps {
    return {
      id: this.id,
      scores: [...this.scores],
      overallScore: this.overallScore,
      metadata: { ...this.metadata },
      tenantId: this.tenantId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
