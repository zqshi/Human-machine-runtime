import { pgTable, varchar, jsonb, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * cockpit 编排子系统实体表（v2.1 EAOS domain 建模，破 EAV 贫血 §12信号1）。
 *
 * 从 cockpit_entities EAV 迁出为独立实体表（DB 级约束 + 可索引）。
 * 三实体对标后端 orchestration.ts 现有 route 字段（实现态契约）——前端 cockpitApiAdapter
 * 无 orchestration DTO，前端 EscalationChain/CollaborationChain 是字段不对等的设计态超前模型，
 * 不 1:1 复刻（守 Phase B/E10 教训 §6.3，避免有损映射）。
 *
 * 诚实分层：orchestration_chains 完全结构化（route 有固定字段 steps/currentStep/status）；
 * escalations/orchestration_agents 半结构化（route body 透传无固定契约，提 status/registeredAt
 * 强类型列 + metadata jsonb 透传剩余，不强加超前列）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 */

/**
 * orchestration_chains — 编排链（多步骤任务推进链）。
 *
 * status 限定枚举 active|completed|paused|failed（domain 校验，脏数据拒建）；
 * steps 存 OrchestrationStep 值对象数组（jsonb，domain 校验形状）；
 * currentStep >= 0（domain 不变式 clamp）；advance 推进 currentStep，末步 status=completed。
 * advance 是诚实假推进（手动 currentStep++），真调度接 /agent/dispatch 留 [PLANNED]。
 */
export const orchestrationChains = pgTable(
  'orchestration_chains',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 256 }),
    steps: jsonb('steps').notNull().default([]),
    currentStep: integer('current_step').notNull().default(0),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    agentId: varchar('agent_id', { length: 64 }),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_orchestration_chains_status').on(table.status),
    index('idx_orchestration_chains_agent').on(table.agentId),
    index('idx_orchestration_chains_tenant').on(table.tenantId),
    index('idx_orchestration_chains_created').on(table.createdAt),
  ]
);

/**
 * escalations — 升级记录（异常/超时触发的升级生命周期）。
 *
 * status 限定枚举 open|acknowledged|resolved|closed（domain 状态机，非法转换拒）；
 * severity/triggerReason/relatedTaskId 可选（route body 透传的固定语义字段）；
 * metadata jsonb 透传 body 剩余字段（route 无完整固定契约，不强加列，守实现态契约）。
 */
export const escalations = pgTable(
  'escalations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    severity: varchar('severity', { length: 16 }),
    triggerReason: text('trigger_reason'),
    relatedTaskId: varchar('related_task_id', { length: 64 }),
    metadata: jsonb('metadata').notNull().default({}),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_escalations_status').on(table.status),
    index('idx_escalations_tenant').on(table.tenantId),
    index('idx_escalations_created').on(table.createdAt),
  ]
);

/**
 * orchestration_agents — 编排 Agent 注册记录。
 *
 * registeredAt 必填；status 枚举 registered|active|idle|offline（domain 校验若传）；
 * route 无 PATCH 端点，无状态机（仅注册记录，状态机留 [PLANNED]）；
 * metadata jsonb 透传 body 剩余字段（route 无固定契约，不强加列）。
 */
export const orchestrationAgents = pgTable(
  'orchestration_agents',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    agentId: varchar('agent_id', { length: 64 }),
    role: varchar('role', { length: 32 }),
    status: varchar('status', { length: 32 }).notNull().default('registered'),
    metadata: jsonb('metadata').notNull().default({}),
    tenantId: varchar('tenant_id', { length: 64 }),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_orchestration_agents_agent').on(table.agentId),
    index('idx_orchestration_agents_status').on(table.status),
    index('idx_orchestration_agents_tenant').on(table.tenantId),
  ]
);
