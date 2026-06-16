/**
 * 评测引擎类型定义
 */

export type EvalType =
  | 'exact_match'
  | 'structured_match'
  | 'behavioral'
  | 'safety_check'
  | 'llm_judge'
  | 'f1_score'
  | 'trajectory';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TriggerType = 'manual' | 'config_change' | 'scheduled' | 'model_upgrade' | 'ab_test';

export type Verdict = 'PASS' | 'WARNING' | 'FAIL';

/* ──── 评估器类型 ──── */

export type EvaluatorType = 'rule_based' | 'llm_judge' | 'hybrid';

/** 评估维度定义 */
export interface EvalDimension {
  key: string;
  label: string;
  weight: number;
  description?: string;
}

/** 评分细则条目 */
export interface ScoringRubricEntry {
  score: number;
  desc: string;
}

/** 规则配置项（rule_based 类型） */
export interface RuleConfigItem {
  type: 'exact_match' | 'contains' | 'regex' | 'json_path_match' | 'script';
  /** 匹配目标字段: output | tool_calls | behavior */
  field: string;
  /** 匹配值或正则表达式，script 类型时为执行函数代码 */
  value: string;
  /** 该规则权重 0-1 */
  weight: number;
  /** JSON Path（仅 json_path_match 类型使用） */
  jsonPath?: string;
  /** 脚本语言（仅 script 类型使用） */
  language?: 'python' | 'javascript';
}

/** LLM Judge 配置（llm_judge 类型） */
export interface JudgeConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  /** 自定义 Prompt 模板，支持变量: {taskDescription} {expectedBehavior} {actualOutput} {rubric} */
  promptTemplate: string;
}

/** 评估器实体 */
export interface EvalEvaluator {
  id: string;
  name: string;
  description: string | null;
  type: EvaluatorType;
  dimensions: EvalDimension[];
  scoringRubric: ScoringRubricEntry[];
  ruleConfig: RuleConfigItem[] | null;
  judgeConfig: JudgeConfig | null;
  threshold: number;
  status: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DimensionScores {
  correctness: number;
  efficiency: number;
  safety: number;
  interaction: number;
  [key: string]: number;
}

export const DIMENSION_WEIGHTS: DimensionScores = {
  correctness: 0.3,
  efficiency: 0.2,
  safety: 0.25,
  interaction: 0.25,
};

export interface CaseEvalContext {
  caseKey: string;
  taskDescription: string;
  context?: Record<string, unknown>;
  evalType: EvalType;
  expectedOutput?: Record<string, unknown>;
  expectedBehavior?: string;
  expectedTrajectory?: string;
  expectedTools?: string[];
  matchRules?: Record<string, string>;
  rubric?: Record<string, string>;
}

export interface CaseEvalResult {
  score: number;
  dimensionScores: DimensionScores;
  passed: boolean;
  actualOutput?: string;
  toolCallsLog?: unknown[];
  durationMs: number;
  tokenUsage: number;
  judgeResponse?: Record<string, unknown>;
  failureReason?: string;
}

export interface RunSummary {
  overallScore: number;
  dimensionScores: DimensionScores;
  verdict: Verdict;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  totalTokens: number;
  totalCost: number;
}

/** LLM Judge 评判请求 */
export interface JudgeRequest {
  taskDescription: string;
  rubric: Record<string, string>;
  actualOutput: string;
  expectedBehavior?: string;
  toolCalls?: string[];
  stepCount?: number;
  durationMs?: number;
}

/** LLM Judge 评判响应 */
export interface JudgeResponse {
  task_understanding: number;
  execution_quality: number;
  delivery_quality: number;
  total: number;
  comment: string;
  top_issue?: string;
}

/** 评测报告结构 */
export interface EvalReport {
  runId: string;
  suiteId: string;
  configVersion?: string;
  baselineVersion?: string;
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    degraded: number;
    overallScore: number;
    baselineScore?: number;
    delta?: number;
    verdict: Verdict;
  };
  dimensions: Record<string, { score: number; baseline?: number; delta?: number }>;
  failures: Array<{
    caseId: string;
    caseKey: string;
    category: string;
    expected: string;
    actual: string;
    score: number;
    regression: boolean;
  }>;
  improvements: Array<{
    caseId: string;
    caseKey: string;
    scoreBefore: number;
    scoreAfter: number;
  }>;
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
  }>;
  generatedAt: string;
}
