import { pgTable, varchar, jsonb, text, bigint, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * cockpit 感知子系统实体表（v2.1 EAOS domain 建模，破 EAV 贫血 §12信号1）。
 *
 * 从 cockpit_entities EAV 单表迁出为独立实体表（DB 级约束 + 可索引）。
 * domain 实体 EmergentSignal/Pattern 对标前端 client-suite domain/sensing/（immutable DDD）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 */

/**
 * emergent_signals — 涌现信号（感知反馈回路产物）。
 *
 * 由 dispatch trace 异常检测自动提取（④数据回流）或人工录入。
 * severity/status 限定枚举（domain 不变式 clamp）；correlatedSignalIds 关联信号聚合（jsonb）。
 * detectedAt/resolvedAt 存 epoch ms（bigint，前端 Date.now() 语义）。
 */
export const emergentSignals = pgTable(
  'emergent_signals',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    patternId: varchar('pattern_id', { length: 64 }),
    correlatedSignalIds: jsonb('correlated_signal_ids').notNull().default([]),
    pattern: text('pattern'),
    severity: varchar('severity', { length: 16 }).notNull().default('medium'),
    suggestedAction: text('suggested_action'),
    status: varchar('status', { length: 32 }).notNull().default('detected'),
    detectedAt: bigint('detected_at', { mode: 'number' }),
    resolvedAt: bigint('resolved_at', { mode: 'number' }),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_emergent_signals_severity').on(table.severity),
    index('idx_emergent_signals_status').on(table.status),
    index('idx_emergent_signals_detected').on(table.detectedAt),
    index('idx_emergent_signals_tenant').on(table.tenantId),
  ]
);

/**
 * patterns — 模式（感知模式识别产物）。
 *
 * pattern / knowledge_pattern 两类 entityType 合并（patternType 字段区分）。
 */
export const patterns = pgTable(
  'patterns',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    patternType: varchar('pattern_type', { length: 32 }).notNull().default('pattern'),
    pattern: text('pattern'),
    data: jsonb('data').notNull().default({}),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_patterns_type').on(table.patternType)]
);
