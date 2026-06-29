/**
 * Decision — 判断领域实体（v2.1 EAOS 判断子系统，对标前端 DecisionRequest DTO 扁平统一结构）。
 *
 * immutable DDD 风格：private constructor + static create/fromProps + 状态转换返回新实例。
 * 不变式：urgency/responseStatus 限定枚举（fromProps 校验，DB 脏数据拒建）；impactScope >= 0；
 * alternatives/downstreamTaskIds/downstreamGoalIds 默认 []。
 * respond 状态机对标前端 respondDecision 契约（action: accept|modify|decline|defer + feedback/optionId/deferUntil）。
 * 零外部依赖（守 §1.1 domain 纪律，不 import application/adapters/routes/infrastructure）。
 *
 * 对标实现态 DTO 契约（cockpitApiAdapter.toDecisionRequest），非前端设计态超前实体——
 * 不建 DTO 没有的 sourceNotificationId/relatedTaskIds（Phase B 教训：守实现态契约避免有损映射）。
 */

export type DecisionUrgency = 'critical' | 'high' | 'normal' | 'low';
export type DecisionResponseStatus =
  | 'pending'
  | 'accepted'
  | 'modified'
  | 'declined'
  | 'deferred'
  | 'expired';
export type RespondAction = 'accept' | 'modify' | 'decline' | 'defer';
export type RecommendationRiskLevel = 'low' | 'medium' | 'high';

const URGENCIES: readonly DecisionUrgency[] = ['critical', 'high', 'normal', 'low'];
const STATUSES: readonly DecisionResponseStatus[] = [
  'pending',
  'accepted',
  'modified',
  'declined',
  'deferred',
  'expired',
];
const RISK_LEVELS: readonly RecommendationRiskLevel[] = ['low', 'medium', 'high'];

/** RecommendationOption 值对象（对标前端 RecommendationOption，AI 推荐方案）。 */
export interface RecommendationOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly reasoning: string;
  readonly estimatedImpact: string;
  readonly riskLevel: RecommendationRiskLevel;
}

function asUrgency(value: string): DecisionUrgency {
  if (!URGENCIES.includes(value as DecisionUrgency)) {
    throw new Error(`invalid urgency "${value}", expected one of ${URGENCIES.join('|')}`);
  }
  return value as DecisionUrgency;
}

function asStatus(value: string): DecisionResponseStatus {
  if (!STATUSES.includes(value as DecisionResponseStatus)) {
    throw new Error(`invalid responseStatus "${value}", expected one of ${STATUSES.join('|')}`);
  }
  return value as DecisionResponseStatus;
}

function asRiskLevel(value: unknown): RecommendationRiskLevel {
  if (typeof value === 'string' && RISK_LEVELS.includes(value as RecommendationRiskLevel)) {
    return value as RecommendationRiskLevel;
  }
  return 'medium';
}

function clampNonNegative(n: number): number {
  return Math.max(0, n);
}

/** 规整 RecommendationOption：缺字段补空串，riskLevel 校验。 */
function normalizeRecommendation(input: unknown): RecommendationOption {
  const r = (input ?? {}) as Record<string, unknown>;
  return {
    id: typeof r.id === 'string' ? r.id : '',
    label: typeof r.label === 'string' ? r.label : '',
    description: typeof r.description === 'string' ? r.description : '',
    reasoning: typeof r.reasoning === 'string' ? r.reasoning : '',
    estimatedImpact: typeof r.estimatedImpact === 'string' ? r.estimatedImpact : '',
    riskLevel: asRiskLevel(r.riskLevel),
  };
}

function normalizeOptions(input: unknown): RecommendationOption[] {
  if (!Array.isArray(input)) return [];
  return input.map(normalizeRecommendation);
}

export interface DecisionProps {
  id: string;
  agentId?: string;
  title?: string;
  context?: string;
  recommendation: RecommendationOption;
  alternatives: RecommendationOption[];
  urgency: DecisionUrgency;
  deadline: number;
  responseStatus: DecisionResponseStatus;
  userResponse?: string;
  responseAt?: number;
  impactScope: number;
  downstreamTaskIds: string[];
  downstreamGoalIds: string[];
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDecisionInput {
  id?: string;
  agentId?: string;
  title?: string;
  context?: string;
  recommendation?: Partial<RecommendationOption>;
  alternatives?: RecommendationOption[];
  urgency?: DecisionUrgency;
  deadline?: number;
  responseStatus?: DecisionResponseStatus;
  userResponse?: string;
  responseAt?: number;
  impactScope?: number;
  downstreamTaskIds?: string[];
  downstreamGoalIds?: string[];
  tenantId?: string;
}

export interface RespondParams {
  feedback?: string;
  optionId?: string;
  deferUntil?: number;
}

export class Decision {
  readonly id: string;
  readonly agentId?: string;
  readonly title?: string;
  readonly context?: string;
  readonly recommendation: RecommendationOption;
  readonly alternatives: RecommendationOption[];
  readonly urgency: DecisionUrgency;
  readonly deadline: number;
  readonly responseStatus: DecisionResponseStatus;
  readonly userResponse?: string;
  readonly responseAt?: number;
  readonly impactScope: number;
  readonly downstreamTaskIds: string[];
  readonly downstreamGoalIds: string[];
  readonly tenantId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: DecisionProps) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.title = props.title;
    this.context = props.context;
    this.recommendation = props.recommendation;
    this.alternatives = props.alternatives;
    this.urgency = props.urgency;
    this.deadline = props.deadline;
    this.responseStatus = props.responseStatus;
    this.userResponse = props.userResponse;
    this.responseAt = props.responseAt;
    this.impactScope = props.impactScope;
    this.downstreamTaskIds = props.downstreamTaskIds;
    this.downstreamGoalIds = props.downstreamGoalIds;
    this.tenantId = props.tenantId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** 工厂：新建 decision（默认 responseStatus=pending, urgency=normal, impactScope=0, 时间戳 now）。 */
  static create(input: CreateDecisionInput): Decision {
    const now = new Date();
    return new Decision({
      id: input.id ?? `dec-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      agentId: input.agentId,
      title: input.title,
      context: input.context,
      recommendation: normalizeRecommendation(input.recommendation),
      alternatives: normalizeOptions(input.alternatives),
      urgency: input.urgency ? asUrgency(input.urgency) : 'normal',
      deadline: typeof input.deadline === 'number' ? input.deadline : 0,
      responseStatus: input.responseStatus ? asStatus(input.responseStatus) : 'pending',
      userResponse: input.userResponse,
      responseAt: input.responseAt,
      impactScope: clampNonNegative(input.impactScope ?? 0),
      downstreamTaskIds: input.downstreamTaskIds ?? [],
      downstreamGoalIds: input.downstreamGoalIds ?? [],
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** DB 重建：校验 urgency/responseStatus 不变式，脏数据拒建。recommendation/alternatives 规整。 */
  static fromProps(props: DecisionProps): Decision {
    return new Decision({
      id: props.id,
      agentId: props.agentId,
      title: props.title,
      context: props.context,
      recommendation: normalizeRecommendation(props.recommendation),
      alternatives: normalizeOptions(props.alternatives),
      urgency: asUrgency(props.urgency),
      deadline: props.deadline,
      responseStatus: asStatus(props.responseStatus),
      userResponse: props.userResponse,
      responseAt: props.responseAt,
      impactScope: clampNonNegative(props.impactScope),
      downstreamTaskIds: props.downstreamTaskIds,
      downstreamGoalIds: props.downstreamGoalIds,
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * respond 状态机（对标前端 respondDecision 契约）：action 映射 responseStatus，
   * 返回新实例（updatedAt/responseAt 刷新）。原实例 immutable。
   * - accept → accepted（userResponse = feedback ?? optionId ?? action）
   * - decline → declined（userResponse = feedback ?? action）
   * - defer → deferred（deadline = deferUntil ?? 原 deadline）
   * - modify → modified（userResponse = feedback ?? optionId）
   */
  respond(action: RespondAction, params: RespondParams = {}): Decision {
    const now = Date.now();
    const base = this.toProps();
    switch (action) {
      case 'accept':
        return new Decision({
          ...base,
          responseStatus: 'accepted',
          userResponse: params.feedback ?? params.optionId ?? 'accept',
          responseAt: now,
          updatedAt: new Date(),
        });
      case 'decline':
        return new Decision({
          ...base,
          responseStatus: 'declined',
          userResponse: params.feedback ?? 'decline',
          responseAt: now,
          updatedAt: new Date(),
        });
      case 'defer':
        return new Decision({
          ...base,
          responseStatus: 'deferred',
          responseAt: now,
          deadline: typeof params.deferUntil === 'number' ? params.deferUntil : this.deadline,
          updatedAt: new Date(),
        });
      case 'modify':
        return new Decision({
          ...base,
          responseStatus: 'modified',
          userResponse: params.feedback ?? params.optionId,
          responseAt: now,
          updatedAt: new Date(),
        });
    }
  }

  /** 标记过期（deadline 超时且未响应）。 */
  expire(): Decision {
    return new Decision({ ...this.toProps(), responseStatus: 'expired', updatedAt: new Date() });
  }

  // ── 派生查询 ──

  get isPending(): boolean {
    return this.responseStatus === 'pending';
  }

  get isTerminal(): boolean {
    return (
      this.responseStatus === 'accepted' ||
      this.responseStatus === 'declined' ||
      this.responseStatus === 'expired'
    );
  }

  get isExpired(): boolean {
    return this.responseStatus === 'pending' && this.deadline > 0 && Date.now() > this.deadline;
  }

  get timeRemaining(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  /** 序列化（repository 写 DB / route 序列化用）。 */
  toProps(): DecisionProps {
    return {
      id: this.id,
      agentId: this.agentId,
      title: this.title,
      context: this.context,
      recommendation: this.recommendation,
      alternatives: this.alternatives,
      urgency: this.urgency,
      deadline: this.deadline,
      responseStatus: this.responseStatus,
      userResponse: this.userResponse,
      responseAt: this.responseAt,
      impactScope: this.impactScope,
      downstreamTaskIds: this.downstreamTaskIds,
      downstreamGoalIds: this.downstreamGoalIds,
      tenantId: this.tenantId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
