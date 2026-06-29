import {
  pgTable,
  varchar,
  jsonb,
  text,
  bigint,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * cockpit 判断子系统实体表（v2.1 EAOS domain 建模，破 EAV 贫血 §12信号1）。
 *
 * 从 cockpit_entities EAV 迁出为独立实体表（DB 级约束 + 可索引）。
 * domain 实体 Decision 对标前端 DecisionRequest DTO（扁平统一结构）；
 * JudgmentRecord 对标前端 JudgmentRecord.rehydrate（含 contextSnapshot 快照）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 */

/**
 * decisions — AI 决策请求（需人类判断的节点）。
 *
 * urgency/responseStatus 限定枚举（domain 校验，脏数据拒建）。
 * recommendation/alternatives 存 RecommendationOption 值对象（jsonb）。
 * deadline/responseAt 存 epoch ms（bigint，DTO 是 number，零转换）。
 * impactScope >= 0（domain 不变式）；downstreamTaskIds/downstreamGoalIds jsonb 数组。
 * tenantId 用于 DB 级多租户隔离（DTO 暂不暴露但表须有，同 objective）。
 */
export const decisions = pgTable(
  'decisions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    agentId: varchar('agent_id', { length: 64 }),
    title: varchar('title', { length: 256 }),
    context: text('context'),
    recommendation: jsonb('recommendation').notNull().default({}),
    alternatives: jsonb('alternatives').notNull().default([]),
    urgency: varchar('urgency', { length: 16 }).notNull().default('normal'),
    deadline: bigint('deadline', { mode: 'number' }),
    responseStatus: varchar('response_status', { length: 32 }).notNull().default('pending'),
    userResponse: text('user_response'),
    responseAt: bigint('response_at', { mode: 'number' }),
    impactScope: integer('impact_scope').notNull().default(0),
    downstreamTaskIds: jsonb('downstream_task_ids').notNull().default([]),
    downstreamGoalIds: jsonb('downstream_goal_ids').notNull().default([]),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_decisions_status').on(table.responseStatus),
    index('idx_decisions_agent').on(table.agentId),
    index('idx_decisions_tenant').on(table.tenantId),
    index('idx_decisions_created').on(table.createdAt),
  ]
);

/**
 * judgment_records — 判断审计记录（decision 被响应后留痕）。
 *
 * source/action 限定枚举（domain 校验）。
 * respondedAt/createdAt 存 epoch ms（bigint，responseDurationMs = respondedAt - createdAt）。
 * contextSnapshot 存 JudgmentContextSnapshot 值对象（jsonb，判断时决策上下文快照）。
 */
export const judgmentRecords = pgTable(
  'judgment_records',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    decisionId: varchar('decision_id', { length: 64 }),
    source: varchar('source', { length: 32 }).notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    selectedOptionId: varchar('selected_option_id', { length: 64 }),
    feedback: text('feedback'),
    respondedAt: bigint('responded_at', { mode: 'number' }).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    contextSnapshot: jsonb('context_snapshot').notNull().default({}),
  },
  (table) => [
    index('idx_judgment_records_decision').on(table.decisionId),
    index('idx_judgment_records_source').on(table.source),
    index('idx_judgment_records_action').on(table.action),
  ]
);
