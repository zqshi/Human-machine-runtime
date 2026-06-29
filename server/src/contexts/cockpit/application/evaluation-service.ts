/**
 * EvaluationService — cockpit 评估子系统用例编排（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 封装 routes/cockpit/evaluation.ts 的业务逻辑：
 * - metrics CRUD（实体表，dimension/score 强类型列）
 * - scorecards CRUD（create 时算 overallScore 不变式，domain 计算）
 * - dual-track：human/agent 双轨对比 + LLM 洞察（端口注入 generateInsights）
 * - trends：按 createdAt 排序取最近 50 数据点
 *
 * dual-track 是 E12 唯一带 LLM 的聚合查询（E10/E11 无）。
 * InsightsPort 注入 routes/cockpit/llm-analysis.generateInsights（避免 application→routes 反向依赖 §1.1）。
 * port=null → comparisonInsights=[]（增强字段，不 503——无 LLM 仍返 metrics+summary，
 * 对齐原 route generateInsights(llm??null) 未配置返 [] 行为，诚实不 mock）。
 * generateInsights 不动（C20 已 done + llm-analysis.test.ts 已覆盖容错）。
 * 原 route 不发 evaluation 事件，service 不发（守原行为，不 scope creep）。
 */
import type {
  EvaluationMetricRepository,
  EvaluationMetricListOptions,
} from '../../../db/repositories/evaluation-metric-repository.js';
import type {
  ScorecardRepository,
  ScorecardListOptions,
} from '../../../db/repositories/scorecard-repository.js';
import {
  EvaluationMetric,
  type CreateEvaluationMetricInput,
} from '../domain/evaluation/evaluation-metric.js';
import { Scorecard, type CreateScorecardInput } from '../domain/evaluation/scorecard.js';

/**
 * 评估洞察端口（注入 routes/cockpit/llm-analysis.generateInsights，避免 application→routes 反向依赖）。
 * 接受序列化后的 metric Record[]（domain 不透出给 LLM 层，port 只认数据形状）。
 * 同形 Phase B DecodeStrategyPort（纯数据参数、无依赖对象）。
 */
export type InsightsPort = (
  humanMetrics: Array<Record<string, unknown>>,
  aiMetrics: Array<Record<string, unknown>>
) => Promise<string[]>;

/** 聚合查询（dual-track/trends）全量取上限，同 repo MAX_LIMIT（百级量可接受，超 200 记 backlog）。 */
const AGG_LIMIT = 200;

/** trends 数据点上限（原 route slice(-50) 语义）。 */
const TRENDS_LIMIT = 50;

export interface DualTrackResult {
  humanTrack: { metrics: EvaluationMetric[]; avgScore: number };
  agentTrack: { metrics: EvaluationMetric[]; avgScore: number };
  comparisonInsights: string[];
}

export class EvaluationService {
  constructor(
    private metricRepo: EvaluationMetricRepository,
    private scorecardRepo: ScorecardRepository,
    private insightsPort: InsightsPort | null
  ) {}

  // ── metrics ──

  /** 列表（filter + 分页下推 DB，§7.2.1#2）。 */
  async listMetrics(opts: EvaluationMetricListOptions = {}) {
    return this.metricRepo.listPaged(opts);
  }

  async createMetric(input: CreateEvaluationMetricInput): Promise<EvaluationMetric> {
    const m = EvaluationMetric.create(input);
    await this.metricRepo.save(m);
    return m;
  }

  // ── scorecards ──

  /** 列表（filter + 分页下推 DB，§7.2.1#2）。 */
  async listScorecards(opts: ScorecardListOptions = {}) {
    return this.scorecardRepo.listPaged(opts);
  }

  /** create 时 domain 算 overallScore（不变式，忽略入参 overallScore 防外部传错）。 */
  async createScorecard(input: CreateScorecardInput): Promise<Scorecard> {
    const s = Scorecard.create(input);
    await this.scorecardRepo.save(s);
    return s;
  }

  async getScorecard(id: string): Promise<Scorecard | null> {
    return this.scorecardRepo.findById(id);
  }

  // ── 聚合查询 ──

  /**
   * dual-track：human/agent 双轨对比 + LLM 洞察。
   * 全量取 metrics（AGG_LIMIT 200，聚合查询非分页，同 E10 analytics 全量范式）+ 内存分轨。
   * insights 委托 InsightsPort（接真 LLM）；port=null → []（增强字段，不 503，对齐原 route 行为）。
   */
  async dualTrack(): Promise<DualTrackResult> {
    const all = await this.metricRepo.list({ limit: AGG_LIMIT });
    const human = all.filter((m) => m.isHumanTrack);
    const agent = all.filter((m) => m.isAgentTrack);
    const comparisonInsights = this.insightsPort
      ? await this.insightsPort(
          human.map((m) => m.toProps() as unknown as Record<string, unknown>),
          agent.map((m) => m.toProps() as unknown as Record<string, unknown>)
        )
      : [];
    return {
      humanTrack: { metrics: human, avgScore: EvaluationMetric.avgOf(human) },
      agentTrack: { metrics: agent, avgScore: EvaluationMetric.avgOf(agent) },
      comparisonInsights,
    };
  }

  /**
   * trends：按 createdAt 升序取最近 50 数据点（原 route sort+slice(-50) 语义）。
   * 全量取（AGG_LIMIT 200）+ 内存 sort，不 DB 下推避免 slice(-50)≠asc+limit 语义 bug（同 E10 范式）。
   * period 参数原 route 只 echo 未过滤，保持原样不假实现真过滤（记 backlog）。
   */
  async trends(period: string): Promise<{ period: string; dataPoints: EvaluationMetric[] }> {
    const all = await this.metricRepo.list({ limit: AGG_LIMIT });
    const sorted = [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return { period, dataPoints: sorted.slice(-TRENDS_LIMIT) };
  }
}
