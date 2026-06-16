/**
 * jobSpecs —— 前端任务规格注册表（扩展性地基）
 *
 * 与后端 JobHandlerRegistry 对称：后端按 jobType/handlerKey 解析 handler，
 * 前端按 spec 渲染配置表单。新增任务类型只需：
 *   1) 后端 register 一个 handler
 *   2) 这里加一条 JOB_SPECS 条目
 * ScheduledTaskEditor 零改动即可渲染新类型的配置表单。
 */

import { dimensionOptions, DIMENSION_DEFAULTS } from './reportDimensions';

export type JobType = 'agent' | 'system';

export type FieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'markdown'
  | 'json'
  | 'select'
  | 'checkbox-group'
  | 'tag-input'
  | 'boolean';

export interface FieldOption {
  value: string;
  label: string;
  /** 可选分组：CheckboxGroup 检测到则按 group 分组渲染（带小标题） */
  group?: string;
}

/** 字段条件显示：equals（值相等）或 includes（数组包含）二选一 */
export type ShowWhen =
  | { key: string; equals: unknown }
  | { key: string; includes: unknown };

/**
 * 判断字段在当前值集下是否可见（showWhen 条件求值的唯一入口）。
 * 支持两种条件：equals（标量相等）/ includes（数组包含某值）。
 * 新增条件类型时只改这里，调用方零改动。
 */
export function fieldVisible(
  field: { showWhen?: ShowWhen },
  values: Record<string, unknown>
): boolean {
  const cond = field.showWhen;
  if (!cond) return true;
  const v = values[cond.key];
  if ('equals' in cond) return v === cond.equals;
  if ('includes' in cond) return Array.isArray(v) && v.includes(cond.includes);
  return true;
}

export interface JobFieldSpec {
  /** payload 中的 key */
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: FieldOption[];
  default?: unknown;
  required?: boolean;
  help?: string;
  /** 条件显示：当另一字段满足 equals/includes 时才渲染本字段（字段联动） */
  showWhen?: ShowWhen;
}

export interface JobSpec {
  /** 唯一标识：'agent' | 'system:<handlerKey>' */
  id: string;
  jobType: JobType;
  handlerKey?: string;
  label: string;
  icon: string;
  description: string;
  fields: JobFieldSpec[];
  /** 限制可选调度频次（如周期报告只允许 weekly/monthly）；不填则全部可选 */
  allowedFreqModes?: FreqMode[];
  /** 标记后端尚未实现的作业（前端可提示） */
  backendPending?: boolean;
}

export const JOB_SPECS: JobSpec[] = [
  {
    id: 'agent',
    jobType: 'agent',
    label: '数字员工执行',
    icon: 'smart_toy',
    description: '定时触发数字员工/LLM 执行一次任务，产出结论',
    fields: [
      { key: 'instanceId', label: '数字员工 ID', type: 'text', placeholder: 'inst_xxx', required: true },
      { key: 'modelId', label: '模型 ID', type: 'text', placeholder: '留空用默认', help: '可选' },
      { key: 'prompt', label: '执行指令', type: 'textarea', required: true },
    ],
  },
  {
    id: 'system:echo',
    jobType: 'system',
    handlerKey: 'echo',
    label: '回显自检',
    icon: 'terminal',
    description: '回显参数，用于调度链路自检',
    fields: [{ key: 'params', label: '参数（任意 JSON）', type: 'json', default: {} }],
  },
  {
    id: 'system:weekly-report',
    jobType: 'system',
    handlerKey: 'weekly-report',
    label: '报告统计',
    icon: 'mail',
    description: '按周期聚合对话/Token/留存等指标，生成报告存档（通知渠道后期统一接入）',
    // 周期报告只允许 weekly/monthly：统计窗口由频次自动推导，避免频次与范围冲突
    allowedFreqModes: ['weekly', 'monthly'],
    fields: [
      {
        key: 'dimensions',
        label: '分析维度',
        type: 'checkbox-group',
        // 维度选项从 reportDimensions 库派生（单一数据源），不在 spec 内硬编码
        default: DIMENSION_DEFAULTS,
        options: dimensionOptions(),
        help: '勾选要纳入报告的分析维度；质量分析类维度依赖 LLM 分类/归纳管线（后端落地后生效）',
      },
      {
        key: 'prompt',
        label: '分析指令（Prompt）',
        type: 'textarea',
        placeholder:
          '驱动 LLM 做分类与归纳的指令。例：对用户消息做 complaint/praise 分类；把高频吐槽归纳为典型场景案例，标注优先级与频次，给出改进建议；按 ±2σ 标记异常指标',
        help: '指导 LLM 的情感分类与问题归纳方向；留空则用默认分析指令',
      },
      // ── 分析参数：仅在勾选对应维度时显示（showWhen includes），避免无关字段堆砌 ──
      {
        key: 'sampleMax',
        label: '情感分析采样上限',
        type: 'number',
        default: 500,
        showWhen: { key: 'dimensions', includes: 'complaint-analysis' },
        help: '消息量超过该值时采样（取前 N + 后 N），控制 LLM 分类成本；仅吐槽/赞许分析维度生效',
      },
      {
        key: 'anomalySigma',
        label: '异常检测阈值（σ）',
        type: 'number',
        default: 2,
        showWhen: { key: 'dimensions', includes: 'anomaly-watch' },
        help: '指标偏离 7 日均值超过 N 个标准差视为异常；仅突发观察维度生效',
      },
      {
        key: 'leaderboardTopN',
        label: '排行榜 Top N',
        type: 'number',
        default: 20,
        showWhen: { key: 'dimensions', includes: 'user-leaderboard' },
        help: '用户使用排行展示前 N 名；仅使用排行维度生效',
      },
      {
        key: 'templateMd',
        label: '输出模板（Markdown）',
        type: 'markdown',
        placeholder:
          '可选；自定义报告 Markdown 格式，用 {{dau}} {{tokens}} {{retention}} 等占位符引用指标，留空用默认模板',
        help: '支持 Markdown 语法编辑与实时预览，也可粘贴 .md 模板',
      },
    ],
  },
  {
    id: 'system:trace-cleanup',
    jobType: 'system',
    handlerKey: 'trace-cleanup',
    label: '调用追踪清理',
    icon: 'cleaning_services',
    description: '清理超过 N 天的 ai_traces 记录',
    fields: [
      { key: 'olderThanDays', label: '保留天数', type: 'number', default: 90, required: true },
    ],
  },
  {
    id: 'system:employee-cleanup',
    jobType: 'system',
    handlerKey: 'employee-cleanup',
    label: '离职员工监测与清理',
    icon: 'person_remove',
    description: '监测离职/长期未活跃的数字员工，按配置清理实例、账号、记忆等',
    fields: [
      {
        key: 'criteria',
        label: '离职判定方式',
        type: 'select',
        default: 'inactive',
        options: [
          { value: 'inactive', label: '长期未活跃' },
          { value: 'manager-flagged', label: 'claw-manager 标记离职' },
        ],
      },
      {
        key: 'inactiveDays',
        label: '未活跃天数',
        type: 'number',
        default: 30,
        required: true,
        showWhen: { key: 'criteria', equals: 'inactive' },
        help: '最后活跃时间超过该天数判定为离职',
      },
      {
        key: 'mode',
        label: '监测模式',
        type: 'select',
        default: 'detect-only',
        options: [
          { value: 'detect-only', label: '仅检测（产出离职名单，推荐）' },
          { value: 'detect-and-clean', label: '检测并清理' },
        ],
      },
      {
        key: 'scope',
        label: '清理范围',
        type: 'checkbox-group',
        default: ['instances'],
        showWhen: { key: 'mode', equals: 'detect-and-clean' },
        options: [
          { value: 'instances', label: '数字员工实例' },
          { value: 'accounts', label: '关联账号' },
          { value: 'memory', label: '记忆库数据' },
          { value: 'sessions', label: '会话记录' },
        ],
      },
      {
        key: 'notifyTo',
        label: '结果通知收件人',
        type: 'tag-input',
        placeholder: '可选，监测/清理结果发邮件',
      },
    ],
  },
];

/** 按 jobType + handlerKey 找 spec */
export function findSpec(jobType: string, handlerKey?: string): JobSpec | undefined {
  return JOB_SPECS.find(
    (s) => s.jobType === jobType && (s.handlerKey ?? undefined) === handlerKey
  );
}

/** 按 id 找 spec */
export function findSpecById(id: string): JobSpec | undefined {
  return JOB_SPECS.find((s) => s.id === id);
}

/** 从已有 task 的 jobPayload 反推 spec id */
export function specIdOf(task: {
  jobType: string;
  jobPayload: Record<string, unknown>;
}): string {
  const spec = findSpec(task.jobType, task.jobPayload?.handlerKey as string | undefined);
  return spec?.id ?? (task.jobType === 'agent' ? 'agent' : 'system:echo');
}

/** 由 spec + 当前 payload 值构造提交用的 jobPayload（注入 handlerKey） */
/**
 * 组装最终 jobPayload：注入 handlerKey，并为周报任务按频次推导统计范围 range。
 * freqMode 仅周报 spec 生效（其余 spec 忽略）。
 */
export function buildPayload(
  spec: JobSpec,
  values: Record<string, unknown>,
  freqMode?: FreqMode
): Record<string, unknown> {
  if (spec.jobType === 'system') {
    const base: Record<string, unknown> = { handlerKey: spec.handlerKey, ...values };
    if (spec.id === 'system:weekly-report' && freqMode) {
      base.range = deriveReportRange(freqMode);
    }
    return base;
  }
  return { ...values };
}

export type FreqMode = 'interval' | 'daily' | 'weekly' | 'monthly' | 'cron';

/**
 * 周报任务按调度频次推导统计范围：weekly → 上周，其余（monthly）→ 近 30 天。
 * 频次由 allowedFreqModes 收窄为 weekly/monthly，故无需处理 daily/interval/cron。
 * 推导出的 range 写入 payload，后端 resolveDateRange 按此算窗口。
 */
export function deriveReportRange(freqMode: FreqMode): 'last-week' | 'last-month' {
  return freqMode === 'weekly' ? 'last-week' : 'last-month';
}

/** 调度频率配置：cron 或固定间隔，与后端 scheduleType 契约一致 */
export interface FreqConfig {
  scheduleType: 'cron' | 'interval';
  cronExpr?: string;
  intervalSeconds?: number;
  timezone?: string;
}

/** 从 FreqConfig 反推展示模式（固定间隔/每天/每周/每月/自定义 Cron） */
export function inferMode(v: FreqConfig): FreqMode {
  if (v.scheduleType === 'interval' || v.intervalSeconds) return 'interval';
  const parts = (v.cronExpr ?? '').trim().split(/\s+/);
  if (parts.length !== 5) return 'cron';
  const [m, h, dom, mon, dow] = parts;
  const isN = (s: string) => /^\d+$/.test(s);
  if (isN(m) && isN(h) && dom === '*' && mon === '*' && dow === '*') return 'daily';
  if (isN(m) && isN(h) && dom === '*' && mon === '*' && isN(dow)) return 'weekly';
  if (isN(m) && isN(h) && isN(dom) && mon === '*' && dow === '*') return 'monthly';
  return 'cron';
}
