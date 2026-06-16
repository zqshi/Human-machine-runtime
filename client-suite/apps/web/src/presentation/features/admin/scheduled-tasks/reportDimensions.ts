/**
 * 报告维度库 —— 周报/月报类任务的「分析维度」单一数据源。
 *
 * 设计目标（避免硬编码）：
 * - 维度是可注册的一等公民，不写死在某个 spec 的 options 里。
 * - 任意报告类 spec（weekly-report 及未来其他）按需引用库中的维度子集。
 * - 新增维度只需在此注册一条，所有引用该库的 spec 自动可见，无需改 spec/FieldRenderer。
 * - group 用于前端分组展示；requires 声明该维度依赖的数据源（后端实现管线时按此判断可用性，
 *   前端仅展示，不做硬性拦截——避免后端未就绪时锁死前端）。
 *
 * 当前维度覆盖「基础统计」+「这份情感分析周报的十个章节」，前者后端部分已实现，
 * 后者依赖 LLM 分类/归纳管线（后端 P2/P4，待落地）。前端配置能力先行。
 */

export type DimensionGroup = 'basic' | 'engagement' | 'quality';

export interface ReportDimension {
  id: string;
  label: string;
  group: DimensionGroup;
  /** 该维度需要的数据源标识；后端按此判断是否可产出，前端不拦截 */
  requires?: string[];
  description: string;
}

export const DIMENSION_GROUP_LABEL: Record<DimensionGroup, string> = {
  basic: '基础统计',
  engagement: '用户行为',
  quality: '质量分析',
};

/**
 * 维度注册表。修改这里 = 全局生效。
 * 顺序即展示顺序（组内按数组顺序，组间按 basic → engagement → quality）。
 */
export const REPORT_DIMENSIONS: ReportDimension[] = [
  // ── 基础统计（后端 AnalyticsService 部分已支持）──
  { id: 'overview', label: '总览', group: 'basic', requires: ['conversations', 'tokens'], description: '消息/采样/活跃/Q&A/响应时间/AI 错误汇总' },
  { id: 'dau', label: 'DAU/消息量', group: 'basic', requires: ['conversations'], description: '日均/峰值 DAU 与消息量趋势' },
  { id: 'tokens', label: 'Token/成本', group: 'basic', requires: ['tokens'], description: 'Token 消耗与成本' },
  { id: 'retention', label: '留存', group: 'basic', requires: ['conversations'], description: '用户留存率' },
  { id: 'daily-trend', label: '每日交互趋势', group: 'basic', requires: ['conversations'], description: '按日的消息数 / Q&A 对数趋势' },
  // ── 用户行为 ──
  { id: 'active-hours', label: '活跃时段', group: 'engagement', requires: ['conversations'], description: '小时级 QA/吐槽/赞许/响应/错误分布，峰值时段' },
  { id: 'engagement-layer', label: '粘性分层', group: 'engagement', requires: ['conversations'], description: '按消息数分层的用户占比（一次性/浅尝/.../重度）' },
  { id: 'user-leaderboard', label: '使用排行', group: 'engagement', requires: ['conversations'], description: 'Top N 用户（Q&A 数/活跃天数/时长/响应）' },
  { id: 'period-compare', label: '环比变化', group: 'engagement', requires: ['conversations'], description: '本周 vs 上周同口径对比，趋势标记' },
  // ── 质量分析（依赖 LLM 分类/归纳管线，后端待落地）──
  { id: 'anomaly-watch', label: '突发与持续观察', group: 'quality', requires: ['conversations'], description: '±Nσ 异常指标检测，标记突发波动' },
  { id: 'complaint-analysis', label: '吐槽分析', group: 'quality', requires: ['conversations', 'llm-sentiment'], description: 'LLM 分类 complaint，按类目统计与环比' },
  { id: 'praise-analysis', label: '赞许分析', group: 'quality', requires: ['conversations', 'llm-sentiment'], description: 'LLM 分类 praise，按类目统计与环比' },
  { id: 'ai-issues', label: 'AI 表现与问题', group: 'quality', requires: ['conversations', 'llm-sentiment'], description: 'LLM 归纳典型场景案例 + 改进建议' },
];

/** 默认勾选的维度（基础统计 + 核心用户行为） */
export const DIMENSION_DEFAULTS: string[] = REPORT_DIMENSIONS.filter(
  (d) => d.group === 'basic' || d.id === 'active-hours'
).map((d) => d.id);

/** 维度 id → 定义，供 spec/校验快速查表 */
const DIM_BY_ID = new Map(REPORT_DIMENSIONS.map((d) => [d.id, d]));

/** 维度 id 是否已注册（校验旧任务的 payload 用） */
export function isKnownDimension(id: string): boolean {
  return DIM_BY_ID.has(id);
}

/**
 * 派生 checkbox-group 的 options，带 group 字段供 CheckboxGroup 分组渲染。
 * group 值为中文组名（映射自 DimensionGroup 枚举），CheckboxGroup 直接用它做分组标题，
 * 保持 CheckboxGroup 通用、不耦合维度库。
 * 返回结构兼容 jobSpecs.FieldOption（{value,label,group?}），避免与 jobSpecs 循环 import。
 */
export function dimensionOptions(): { value: string; label: string; group: string }[] {
  return REPORT_DIMENSIONS.map((d) => ({
    value: d.id,
    label: d.label,
    group: DIMENSION_GROUP_LABEL[d.group],
  }));
}

/** 维度的中文描述（表单 help / tooltip 用） */
export function dimensionDescription(id: string): string {
  return DIM_BY_ID.get(id)?.description ?? '';
}
