/**
 * JobHandler — 定时任务执行的领域契约（纯类型，零外部依赖）
 *
 * 不同 jobType 对应不同 handler 实现，通过 JobHandlerRegistry 注册与解析。
 * SchedulerService 在 tick/手动触发时，按 task.jobType 解析 handler 并调用 run()。
 */

/** 任务类型：agent=触发数字员工/LLM 执行；system=通用系统作业 */
export type JobType = 'agent' | 'system';

/** 触发方式 */
export type TriggerType = 'scheduled' | 'manual';

/**
 * jobPayload 自描述结构：
 * - agent: { instanceId, prompt, sessionId?, modelId? }
 * - system: { handlerKey, params? }
 */
export type JobPayload = Record<string, unknown>;

/** handler 执行上下文（由 SchedulerService 构造） */
export interface JobExecutionContext {
  taskId: string;
  jobType: JobType;
  jobPayload: JobPayload;
  triggerType: TriggerType;
  runId: string;
}

/** handler 产出 —— 写入 scheduled_task_runs 的 conclusion / output_payload / metadata */
export interface JobResult {
  /** 产出结论（人类可读文本，前端展示主体） */
  conclusion: string;
  /** 结构化产出（Agent 结果对象 / 系统作业明细） */
  outputPayload?: Record<string, unknown>;
  /** 扩展元数据（traceId / token / cost 等） */
  metadata?: Record<string, unknown>;
}

/** Job handler 契约：实现方负责执行具体业务并产出结论 */
export interface JobHandler {
  readonly type: JobType;
  run(ctx: JobExecutionContext): Promise<JobResult>;
}
