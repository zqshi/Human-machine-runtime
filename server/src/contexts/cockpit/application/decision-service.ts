/**
 * DecisionService — cockpit 判断子系统用例编排（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 封装 routes/cockpit/decisions.ts 的业务逻辑：decisions CRUD（实体表）+ respond 状态机 +
 * judgment_records CRUD + judgment-analytics 聚合。
 * - decisions/judgment_records 走新实体表 repository（破 EAV 贫血，domain 实体不变式守卫）
 * - respond 自动生成 JudgmentRecord 审计留痕（修复原 route respond 不留 record bug——
 *   前端按 decisionId 查 judgment-records 查不到）。record source 默认 agent-discovery（DTO 不含 source）。
 * - getJudgmentAnalytics：全量 list + JudgmentAnalytics.compute 内存算（cockpit 百级量可接受，同 pagination.ts 判断）
 * - inbox 跨聚合聚合（workorder/goal）不进 service，留 route 层调 cockpitRepo
 */
import type {
  DecisionRepository,
  DecisionListOptions,
} from '../../../db/repositories/decision-repository.js';
import type {
  JudgmentRecordRepository,
  JudgmentRecordListOptions,
} from '../../../db/repositories/judgment-record-repository.js';
import {
  Decision,
  type CreateDecisionInput,
  type RespondAction,
  type RespondParams,
} from '../domain/judgment/decision.js';
import {
  JudgmentRecord,
  type DecisionSource,
  type CreateJudgmentRecordInput,
} from '../domain/judgment/judgment-record.js';
import {
  JudgmentAnalytics,
  type JudgmentAnalyticsSnapshot,
} from '../domain/judgment/judgment-analytics.js';
import type { EventBusPort } from './event-bus-port.js';

/** respond 自动生成审计 record 的默认来源（decision DTO 不含 source，前端 rehydrate fallback 同款）。 */
const DEFAULT_RECORD_SOURCE: DecisionSource = 'agent-discovery';

export class DecisionService {
  constructor(
    private decisionRepo: DecisionRepository,
    private judgmentRepo: JudgmentRecordRepository,
    private eventBus: EventBusPort
  ) {}

  /** 列表（filter + 分页下推 DB，§7.2.1#2）。 */
  async listDecisions(opts: DecisionListOptions = {}) {
    return this.decisionRepo.listPaged(opts);
  }

  async createDecision(input: CreateDecisionInput): Promise<Decision> {
    const d = Decision.create(input);
    await this.decisionRepo.save(d);
    this.eventBus.publish('decision:created', d.toProps());
    return d;
  }

  async getDecision(id: string): Promise<Decision | null> {
    return this.decisionRepo.findById(id);
  }

  async deleteDecision(id: string): Promise<boolean> {
    return this.decisionRepo.remove(id);
  }

  /**
   * respond 状态机 + 自动生成 JudgmentRecord 审计留痕。
   * - pending decision 拒 respond（无意义，由前端 expire 处理）
   * - responded 后 fromDecisionResponse 生成 record（accepted/modified 记 recommendation.id）
   * - 发布 decision:updated + judgment:recorded 双事件
   * 返回更新后的 decision（route 包 { decision } 返回前端，守 respondDecision 契约）。
   */
  async respondDecision(
    id: string,
    action: RespondAction,
    params: RespondParams = {}
  ): Promise<Decision | null> {
    const d = await this.decisionRepo.findById(id);
    if (!d) return null;
    const responded = d.respond(action, params);
    await this.decisionRepo.save(responded);
    this.eventBus.publish('decision:updated', responded.toProps());
    // 自动生成审计 record（respond 必然脱离 pending，fromDecisionResponse 不会抛 pending 错）
    const record = JudgmentRecord.fromDecisionResponse(responded, DEFAULT_RECORD_SOURCE);
    await this.judgmentRepo.save(record);
    this.eventBus.publish('judgment:recorded', record.toProps());
    return responded;
  }

  async listJudgmentRecords(opts: JudgmentRecordListOptions = {}) {
    return this.judgmentRepo.listPaged(opts);
  }

  /** 前端主动写 record（保留端点兼容，与 respond 自动生成并存；前端双写需后续核验）。 */
  async createJudgmentRecord(input: CreateJudgmentRecordInput): Promise<JudgmentRecord> {
    const r = JudgmentRecord.create(input);
    await this.judgmentRepo.save(r);
    this.eventBus.publish('judgment:recorded', r.toProps());
    return r;
  }

  /**
   * 判断质量统计：全量 list + JudgmentAnalytics.compute 内存算。
   * cockpit 元数据百级量可接受（同 pagination.ts 判断）；超 MAX_LIMIT(200) 截断记 backlog。
   */
  async getJudgmentAnalytics(): Promise<JudgmentAnalyticsSnapshot> {
    const records = await this.judgmentRepo.list({ limit: 200 });
    return JudgmentAnalytics.compute(records);
  }
}
