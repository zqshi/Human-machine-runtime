import { pgTable, varchar, jsonb, text, real, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * cockpit 战略解码子系统实体表（v2.1 EAOS domain 建模，破 EAV 贫血 §12信号1）。
 *
 * 从 cockpit_entities EAV 迁出为独立实体表（DB 级约束 + 可索引）。
 * domain 实体 Objective 对标前端 ObjectiveDTO（扁平统一结构，level + parentId 层次）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 */

/**
 * objectives — 战略目标（L0/L1/L2 三级层次）。
 *
 * level 区分 L0(战略)/L1(判断)/L2(执行)，parentId 自关联（L1→L0.id, L2→L1.id）。
 * confidence clamp 0-1（domain 不变式）；status 限定枚举 active|completed|paused|abandoned（domain 校验）。
 * metrics 存 PerformanceMetrics 值对象（jsonb，4 个 number 字段）。
 */
export const objectives = pgTable(
  'objectives',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    level: varchar('level', { length: 8 }).notNull(),
    parentId: varchar('parent_id', { length: 64 }),
    tenantId: varchar('tenant_id', { length: 64 }),
    title: varchar('title', { length: 256 }),
    description: text('description'),
    confidence: real('confidence'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    metrics: jsonb('metrics').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_objectives_level').on(table.level),
    index('idx_objectives_parent').on(table.parentId),
    index('idx_objectives_tenant').on(table.tenantId),
    index('idx_objectives_status').on(table.status),
  ]
);
