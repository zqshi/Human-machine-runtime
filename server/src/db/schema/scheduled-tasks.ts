import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * 定时任务定义 —— 仿 eval_suites/llm_models 模式
 *
 * 调度器（SchedulerService）以 next_run_at 为单一到期判据：
 * is_enabled=true AND next_run_at <= now() 的任务在每次 tick 被取出执行。
 */
export const scheduledTasks = pgTable(
  'scheduled_tasks',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    /** agent | system */
    jobType: varchar('job_type', { length: 32 }).notNull(),
    /** 自描述：agent→{instanceId,prompt,...}；system→{handlerKey,params} */
    jobPayload: jsonb('job_payload').notNull(),
    /** cron | interval */
    scheduleType: varchar('schedule_type', { length: 16 }).notNull(),
    cronExpr: varchar('cron_expr', { length: 64 }),
    intervalSeconds: integer('interval_seconds'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Shanghai'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    /** 下次到期时间 —— 调度器据此判定 */
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    /** completed | failed | timeout | dead_letter */
    lastRunStatus: varchar('last_run_status', { length: 16 }),
    lastError: text('last_error'),
    /** 当前重试计数(成功后清零) */
    retryCount: integer('retry_count').notNull().default(0),
    /** 最大尝试次数(含首次) */
    maxAttempts: integer('max_attempts').notNull().default(3),
    /** 进入死信队列时间(null=未死信) */
    deadLetterAt: timestamp('dead_letter_at', { withTimezone: true }),
    deadLetterReason: text('dead_letter_reason'),
    createdBy: varchar('created_by', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_scheduled_tasks_enabled').on(table.isEnabled),
    index('idx_scheduled_tasks_next_run').on(table.nextRunAt),
    index('idx_scheduled_tasks_job_type').on(table.jobType),
    index('idx_scheduled_tasks_dead_letter').on(table.deadLetterAt),
  ]
);

/**
 * 定时任务执行记录 —— 仿 eval_runs/eval_results 状态机
 *
 * status: pending | running | completed | failed | timeout | cancelled
 * conclusion = 产出结论（Agent 文本结论 / 系统作业摘要），前端展示主体
 */
export const scheduledTaskRuns = pgTable(
  'scheduled_task_runs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    taskId: varchar('task_id', { length: 64 })
      .notNull()
      .references(() => scheduledTasks.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    /** scheduled | manual */
    triggerType: varchar('trigger_type', { length: 16 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    /** 产出结论 */
    conclusion: text('conclusion'),
    /** 结构化产出 */
    outputPayload: jsonb('output_payload'),
    errorMessage: text('error_message'),
    /** 扩展元数据（traceId/token/cost） */
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_scheduled_task_runs_task').on(table.taskId),
    index('idx_scheduled_task_runs_status').on(table.status),
    index('idx_scheduled_task_runs_created').on(table.createdAt),
  ]
);
