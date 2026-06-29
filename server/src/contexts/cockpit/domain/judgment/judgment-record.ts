/**
 * JudgmentRecord — 判断审计记录领域实体（v2.1 EAOS 判断子系统，对标前端 JudgmentRecord.rehydrate）。
 *
 * decision 被响应后留痕：记录 action/source/respondedAt + 判断时决策上下文快照（contextSnapshot）。
 * immutable DDD：private constructor + static create/fromProps(rehydrate) + fromDecisionResponse。
 * 不变式：source/action 限定枚举（校验，脏数据拒建）；contextSnapshot 形状守卫。
 * responseDurationMs = respondedAt - createdAt（analytics 响应时间统计依据）。
 * 零外部依赖（守 §1.1 domain 纪律）。
 */

import type { Decision, DecisionResponseStatus } from './decision.js';

/** 决策来源（对标前端 DecisionHub.DecisionSource，5 值枚举）。 */
export type DecisionSource =
  | 'risk-rule-trigger'
  | 'milestone-arrival'
  | 'collaboration-node'
  | 'agent-discovery'
  | 'external-alarm';

const SOURCES: readonly DecisionSource[] = [
  'risk-rule-trigger',
  'milestone-arrival',
  'collaboration-node',
  'agent-discovery',
  'external-alarm',
];

const STATUSES: readonly DecisionResponseStatus[] = [
  'pending',
  'accepted',
  'modified',
  'declined',
  'deferred',
  'expired',
];

/** 判断时决策上下文快照（对标前端 JudgmentContextSnapshot）。 */
export interface JudgmentContextSnapshot {
  readonly title: string;
  readonly context: string;
  readonly urgency: string;
  readonly recommendationLabel: string;
  readonly alternativeCount: number;
}

function asSource(value: string): DecisionSource {
  if (!SOURCES.includes(value as DecisionSource)) {
    throw new Error(`invalid source "${value}", expected one of ${SOURCES.join('|')}`);
  }
  return value as DecisionSource;
}

function asAction(value: string): DecisionResponseStatus {
  if (!STATUSES.includes(value as DecisionResponseStatus)) {
    throw new Error(`invalid action "${value}", expected one of ${STATUSES.join('|')}`);
  }
  return value as DecisionResponseStatus;
}

function coerceSource(value: unknown, fallback: DecisionSource): DecisionSource {
  return typeof value === 'string' && (SOURCES as readonly string[]).includes(value)
    ? (value as DecisionSource)
    : fallback;
}

function coerceAction(value: unknown, fallback: DecisionResponseStatus): DecisionResponseStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
    ? (value as DecisionResponseStatus)
    : fallback;
}

/** 规整 contextSnapshot：缺字段补空串/0（对标前端 rehydrate 的裸 as 收窄为形状守卫）。 */
function normalizeSnapshot(input: unknown): JudgmentContextSnapshot {
  const s = (input ?? {}) as Record<string, unknown>;
  return {
    title: typeof s.title === 'string' ? s.title : '',
    context: typeof s.context === 'string' ? s.context : '',
    urgency: typeof s.urgency === 'string' ? s.urgency : 'normal',
    recommendationLabel: typeof s.recommendationLabel === 'string' ? s.recommendationLabel : '',
    alternativeCount:
      typeof s.alternativeCount === 'number' && Number.isFinite(s.alternativeCount)
        ? Math.max(0, Math.floor(s.alternativeCount))
        : 0,
  };
}

export interface JudgmentRecordProps {
  id: string;
  decisionId: string;
  source: DecisionSource;
  action: DecisionResponseStatus;
  selectedOptionId?: string;
  feedback?: string;
  respondedAt: number;
  createdAt: number;
  contextSnapshot: JudgmentContextSnapshot;
}

export interface CreateJudgmentRecordInput {
  id?: string;
  decisionId: string;
  source: DecisionSource;
  action: DecisionResponseStatus;
  selectedOptionId?: string;
  feedback?: string;
  respondedAt?: number;
  createdAt?: number;
  contextSnapshot?: Partial<JudgmentContextSnapshot>;
}

export class JudgmentRecord {
  readonly id: string;
  readonly decisionId: string;
  readonly source: DecisionSource;
  readonly action: DecisionResponseStatus;
  readonly selectedOptionId?: string;
  readonly feedback?: string;
  readonly respondedAt: number;
  readonly createdAt: number;
  readonly contextSnapshot: JudgmentContextSnapshot;

  private constructor(props: JudgmentRecordProps) {
    this.id = props.id;
    this.decisionId = props.decisionId;
    this.source = props.source;
    this.action = props.action;
    this.selectedOptionId = props.selectedOptionId;
    this.feedback = props.feedback;
    this.respondedAt = props.respondedAt;
    this.createdAt = props.createdAt;
    this.contextSnapshot = props.contextSnapshot;
  }

  /** 工厂：新建 record（默认 id jr- 前缀，时间戳 now）。 */
  static create(input: CreateJudgmentRecordInput): JudgmentRecord {
    const now = Date.now();
    return new JudgmentRecord({
      id: input.id ?? `jr-${now}-${Math.random().toString(36).slice(2, 9)}`,
      decisionId: input.decisionId,
      source: asSource(input.source),
      action: asAction(input.action),
      selectedOptionId: input.selectedOptionId,
      feedback: input.feedback,
      respondedAt: typeof input.respondedAt === 'number' ? input.respondedAt : now,
      createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
      contextSnapshot: normalizeSnapshot(input.contextSnapshot),
    });
  }

  /** DB 重建：校验 source/action 不变式，脏数据拒建。contextSnapshot 规整。 */
  static fromProps(props: JudgmentRecordProps): JudgmentRecord {
    return new JudgmentRecord({
      id: props.id,
      decisionId: props.decisionId,
      source: asSource(props.source),
      action: asAction(props.action),
      selectedOptionId: props.selectedOptionId,
      feedback: props.feedback,
      respondedAt: props.respondedAt,
      createdAt: props.createdAt,
      contextSnapshot: normalizeSnapshot(props.contextSnapshot),
    });
  }

  /**
   * DB 脏数据容错重建（对标前端 rehydrate）：枚举值落白名单返回原值，否则 fallback。
   * 用于 repository 从 jsonb/EAV 读取可能含非法枚举的旧数据时不抛错。
   */
  static rehydrate(props: {
    id: string;
    decisionId: string;
    source: unknown;
    action: unknown;
    selectedOptionId?: string;
    feedback?: string;
    respondedAt: number;
    createdAt: number;
    contextSnapshot: unknown;
  }): JudgmentRecord {
    return new JudgmentRecord({
      id: props.id,
      decisionId: props.decisionId,
      source: coerceSource(props.source, 'agent-discovery'),
      action: coerceAction(props.action, 'expired'),
      selectedOptionId: props.selectedOptionId,
      feedback: props.feedback,
      respondedAt: props.respondedAt,
      createdAt: props.createdAt,
      contextSnapshot: normalizeSnapshot(props.contextSnapshot),
    });
  }

  /**
   * 从已响应 decision 生成审计 record（对标前端 JudgmentRecord.fromDecisionResponse）。
   * pending decision 拒生成（未响应无审计意义）。selectedOptionId 仅 accepted/modified 记 recommendation.id。
   */
  static fromDecisionResponse(decision: Decision, source: DecisionSource): JudgmentRecord {
    if (decision.isPending) {
      throw new Error('Cannot create JudgmentRecord from a pending Decision');
    }
    const selectedOptionId =
      decision.responseStatus === 'accepted' || decision.responseStatus === 'modified'
        ? decision.recommendation.id
        : undefined;
    const now = Date.now();
    return new JudgmentRecord({
      id: `jr-${now}-${Math.random().toString(36).slice(2, 9)}`,
      decisionId: decision.id,
      source,
      action: decision.responseStatus,
      selectedOptionId,
      feedback: decision.userResponse,
      respondedAt: decision.responseAt ?? now,
      createdAt: decision.createdAt.getTime(),
      contextSnapshot: {
        title: decision.title ?? '',
        context: decision.context ?? '',
        urgency: decision.urgency,
        recommendationLabel: decision.recommendation.label,
        alternativeCount: decision.alternatives.length,
      },
    });
  }

  /** 响应耗时（ms）：用于 analytics 响应时间分布统计。 */
  get responseDurationMs(): number {
    return this.respondedAt - this.createdAt;
  }

  /** 序列化（repository 写 DB / route 序列化用）。 */
  toProps(): JudgmentRecordProps {
    return {
      id: this.id,
      decisionId: this.decisionId,
      source: this.source,
      action: this.action,
      selectedOptionId: this.selectedOptionId,
      feedback: this.feedback,
      respondedAt: this.respondedAt,
      createdAt: this.createdAt,
      contextSnapshot: this.contextSnapshot,
    };
  }
}
