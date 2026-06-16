import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * 评测套件 — 一组评测用例的集合
 *
 * configType 决定评测集的配置类型，约束用例字段：
 * - ideal_output: 理想输出评测集（输入 + 期望输出）
 * - workflow:     工作流评测集（执行流程 + 工具调用 + 轨迹验证 + 理想输出）
 */
export const evalSuites = pgTable(
  'eval_suites',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    /** 配置类型: ideal_output | workflow */
    configType: varchar('config_type', { length: 32 }).notNull().default('ideal_output'),
    /** 评测类型（锁定）: exact_match | structured_match | f1_score | behavioral | safety_check | trajectory
     * 创建评测集时选定，约束用例只能使用此类型。null 表示不锁定（历史兼容） */
    evalType: varchar('eval_type', { length: 32 }),
    /** 各 category 的权重 JSON: { "WPS办公自动化": 0.30, ... } */
    categoryWeights: jsonb('category_weights'),
    version: integer('version').notNull().default(1),
    tenantId: varchar('tenant_id', { length: 64 }),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    totalCases: integer('total_cases').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_eval_suites_tenant').on(table.tenantId),
    index('idx_eval_suites_status').on(table.status),
    index('idx_eval_suites_config_type').on(table.configType),
    index('idx_eval_suites_eval_type').on(table.evalType),
  ]
);

/**
 * 评测用例 — 单个 Benchmark Case
 */
export const evalCases = pgTable(
  'eval_cases',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    suiteId: varchar('suite_id', { length: 64 }).notNull(),
    /** 业务 ID，如 WPS-MAIL-001 */
    caseKey: varchar('case_key', { length: 64 }).notNull(),
    version: integer('version').notNull().default(1),
    category: varchar('category', { length: 64 }).notNull(),
    subcategory: varchar('subcategory', { length: 64 }),
    difficulty: varchar('difficulty', { length: 16 }).notNull().default('medium'),
    /** 任务描述（用户输入） */
    taskDescription: text('task_description').notNull(),
    /** 模拟上下文 JSON */
    context: jsonb('context'),
    /** 评测类型: exact_match | structured_match | behavioral | safety_check | llm_judge | f1_score */
    evalType: varchar('eval_type', { length: 32 }).notNull(),
    /** 期望输出 JSON */
    expectedOutput: jsonb('expected_output'),
    /** 期望行为描述 */
    expectedBehavior: text('expected_behavior'),
    /** 期望轨迹（轨迹评测集专用，文本描述式） */
    expectedTrajectory: text('expected_trajectory'),
    /** 期望调用的工具列表 */
    expectedTools: jsonb('expected_tools'),
    /** 匹配规则 JSON */
    matchRules: jsonb('match_rules'),
    /** LLM Judge 评分标准 */
    rubric: jsonb('rubric'),
    /** 标签数组 */
    tags: jsonb('tags'),
    /** 涉及的 MCP 工具 */
    mcpToolsInvolved: jsonb('mcp_tools_involved'),
    /** 涉及的 Skill */
    skillsInvolved: jsonb('skills_involved'),
    /** 来源 trace_id（线上回收时填写） */
    regressionSource: varchar('regression_source', { length: 128 }),
    /** 状态: active | retired | archived */
    status: varchar('status', { length: 16 }).notNull().default('active'),
    /** 连续满分次数（用于退役判断） */
    consecutivePassCount: integer('consecutive_pass_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_eval_cases_suite').on(table.suiteId),
    index('idx_eval_cases_category').on(table.category),
    index('idx_eval_cases_difficulty').on(table.difficulty),
    index('idx_eval_cases_status').on(table.status),
    index('idx_eval_cases_eval_type').on(table.evalType),
  ]
);

/**
 * 评估器 — 可独立配置的评测评分引擎
 */
export const evalEvaluators = pgTable(
  'eval_evaluators',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    /** 评估器类型: rule_based | llm_judge | hybrid */
    type: varchar('type', { length: 32 }).notNull(),
    /** 评估维度定义 JSON: [{ key, label, weight, description }] */
    dimensions: jsonb('dimensions').notNull().default([]),
    /** 评分细则 JSON: [{ score, desc }] */
    scoringRubric: jsonb('scoring_rubric').default([]),
    /** 规则配置 JSON（rule_based 类型）: [{ type, field, value, weight }] */
    ruleConfig: jsonb('rule_config'),
    /** LLM Judge 配置 JSON（llm_judge 类型）: { model, temperature, maxTokens, promptTemplate } */
    judgeConfig: jsonb('judge_config'),
    /** 通过阈值 0-1 */
    threshold: real('threshold').notNull().default(0.8),
    /** 状态: active | archived */
    status: varchar('status', { length: 16 }).notNull().default('active'),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_eval_evaluators_type').on(table.type),
    index('idx_eval_evaluators_status').on(table.status),
    index('idx_eval_evaluators_tenant').on(table.tenantId),
  ]
);

/**
 * 评测运行 — 一次 Benchmark 执行记录
 */
export const evalRuns = pgTable(
  'eval_runs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    suiteId: varchar('suite_id', { length: 64 }).notNull(),
    /** 触发类型: manual | config_change | scheduled | model_upgrade | ab_test */
    triggerType: varchar('trigger_type', { length: 32 }).notNull(),
    /** Agent 配置版本标识 */
    configVersion: varchar('config_version', { length: 64 }),
    /** 对比基线 Run ID */
    baselineRunId: varchar('baseline_run_id', { length: 64 }),
    /** 关联数字员工 ID */
    employeeId: varchar('employee_id', { length: 64 }),
    /** 使用的评估器 ID 列表 JSON: ["evl-xxx", ...] */
    evaluatorIds: jsonb('evaluator_ids'),
    /** 执行环境: staging | dev */
    environment: varchar('environment', { length: 16 }).notNull().default('staging'),
    /** 状态: pending | running | completed | failed | cancelled */
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    /** 总用例数 */
    totalCases: integer('total_cases').notNull().default(0),
    /** 已完成用例数 */
    completedCases: integer('completed_cases').notNull().default(0),
    /** 通过用例数 */
    passedCases: integer('passed_cases').notNull().default(0),
    /** 综合得分 0-1 */
    overallScore: real('overall_score'),
    /** 各维度得分 JSON: { correctness: 0.91, efficiency: 0.85, ... } */
    dimensionScores: jsonb('dimension_scores'),
    /** 判定: PASS | WARNING | FAIL */
    verdict: varchar('verdict', { length: 16 }),
    /** 总 Token 消耗 */
    totalTokens: integer('total_tokens').notNull().default(0),
    /** 总成本（USD） */
    totalCost: real('total_cost').notNull().default(0),
    tenantId: varchar('tenant_id', { length: 64 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_eval_runs_suite').on(table.suiteId),
    index('idx_eval_runs_status').on(table.status),
    index('idx_eval_runs_trigger').on(table.triggerType),
    index('idx_eval_runs_created').on(table.createdAt),
    index('idx_eval_runs_tenant').on(table.tenantId),
    index('idx_eval_runs_employee').on(table.employeeId),
  ]
);

/**
 * 评测结果 — 单个 Case 在某次 Run 中的执行结果
 */
export const evalResults = pgTable(
  'eval_results',
  {
    id: serial('id').primaryKey(),
    runId: varchar('run_id', { length: 64 }).notNull(),
    caseId: varchar('case_id', { length: 64 }).notNull(),
    /** 综合得分 0-1 */
    score: real('score'),
    /** 各维度得分 JSON */
    dimensionScores: jsonb('dimension_scores'),
    /** Agent 实际输出 */
    actualOutput: text('actual_output'),
    /** 工具调用日志 JSON */
    toolCallsLog: jsonb('tool_calls_log'),
    /** 执行时长 ms */
    durationMs: integer('duration_ms'),
    /** Token 消耗 */
    tokenUsage: integer('token_usage'),
    /** LLM Judge 原始响应 */
    judgeResponse: jsonb('judge_response'),
    /** 是否通过 */
    passed: boolean('passed'),
    /** 是否相对基线退化 */
    regression: boolean('regression').default(false),
    /** 失败原因 */
    failureReason: text('failure_reason'),
    /** 执行状态: pending | running | completed | error | skipped */
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_eval_results_run').on(table.runId),
    index('idx_eval_results_case').on(table.caseId),
    index('idx_eval_results_passed').on(table.passed),
  ]
);

/**
 * 线上回收队列 — 从线上失败中采集的候选评测用例
 */
export const evalReplayQueue = pgTable(
  'eval_replay_queue',
  {
    id: serial('id').primaryKey(),
    /** 来源 Trace ID */
    traceId: varchar('trace_id', { length: 128 }).notNull(),
    /** 触发原因: task_failed | human_correction | user_abandoned | safety_violation | high_cost | low_score */
    triggerReason: varchar('trigger_reason', { length: 32 }).notNull(),
    /** 原始用户输入 */
    originalInput: text('original_input'),
    /** Agent 输出 */
    agentOutput: text('agent_output'),
    /** 用户纠正后的输出 */
    userCorrection: text('user_correction'),
    /** 失败模式分类 */
    failureMode: varchar('failure_mode', { length: 32 }),
    /** 审核状态: pending | approved | rejected | promoted */
    reviewStatus: varchar('review_status', { length: 16 }).notNull().default('pending'),
    /** 提升后对应的 Case ID */
    promotedCaseId: varchar('promoted_case_id', { length: 64 }),
    /** 审核人 */
    reviewedBy: varchar('reviewed_by', { length: 64 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_eval_replay_status').on(table.reviewStatus),
    index('idx_eval_replay_trigger').on(table.triggerReason),
    index('idx_eval_replay_tenant').on(table.tenantId),
  ]
);

/**
 * 评测告警规则
 */
export const evalAlertRules = pgTable(
  'eval_alert_rules',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    /** 条件表达式，如 "correctness.task_completed < 0.85" */
    conditionExpr: text('condition_expr').notNull(),
    severity: varchar('severity', { length: 16 }).notNull().default('medium'),
    /** 动作类型: notify | pause_agent | block_deploy */
    actionType: varchar('action_type', { length: 32 }).notNull().default('notify'),
    /** 通知渠道 JSON */
    notificationChannels: jsonb('notification_channels'),
    enabled: boolean('enabled').notNull().default(true),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_eval_alert_rules_tenant').on(table.tenantId),
    index('idx_eval_alert_rules_enabled').on(table.enabled),
  ]
);
