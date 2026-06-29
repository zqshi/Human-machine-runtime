import { pgTable, varchar, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * cockpit 评估子系统实体表（v2.1 EAOS domain 建模，破 EAV 贫血 §12信号1）。
 *
 * 从 cockpit_entities EAV 迁出为独立实体表（DB 级约束 + 可索引）。
 * 两实体对标后端 evaluation.ts 现有 route 字段（实现态契约）——前端 cockpitApiAdapter
 * 无 evaluation DTO（同 E11 orchestration），不建前端设计态超前实体（守 Phase B/E10/E11
 * 教训 §6.3，避免有损映射）。
 *
 * 诚实分层：dimension/score/scores/overallScore 提强类型列（route 已知消费字段）；
 * metadata jsonb 透传 POST body 剩余字段（route 无完整固定契约，不强加超前列）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 */

/**
 * evaluation_metrics — 评估指标（人机双轨 dual-track 的基础数据点）。
 *
 * dimension 限定枚举 human|agent（domain 校验，脏数据拒建；rehydrate fallback human）；
 * score >= 0（domain clamp，非数字当 0）；dual-track 按 dimension 分轨算 avg，trends 按 createdAt 排序。
 * metadata jsonb 透传 body 剩余字段（route 无完整固定契约，不强加列）。
 */
export const evaluationMetrics = pgTable(
  'evaluation_metrics',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    dimension: varchar('dimension', { length: 32 }).notNull().default('human'),
    score: integer('score').notNull().default(0),
    metadata: jsonb('metadata').notNull().default({}),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_evaluation_metrics_dimension').on(table.dimension),
    index('idx_evaluation_metrics_tenant').on(table.tenantId),
    index('idx_evaluation_metrics_created').on(table.createdAt),
    index('idx_evaluation_metrics_score').on(table.score),
  ]
);

/**
 * scorecards — 评估记分卡（多维度打分聚合）。
 *
 * scores 存 ScoreValue 值对象数组（jsonb，domain 校验形状 {value:number}）；
 * overallScore = round(avg(scores[].value))（domain create 时计算，空→0，value 非数字当 0）；
 * create 忽略入参 overallScore（防外部传错，对齐原 route create 时算覆盖行为）。
 * metadata jsonb 透传 body 剩余字段（route 无完整固定契约，不强加列）。
 */
export const scorecards = pgTable(
  'scorecards',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    scores: jsonb('scores').notNull().default([]),
    overallScore: integer('overall_score').notNull().default(0),
    metadata: jsonb('metadata').notNull().default({}),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_scorecards_tenant').on(table.tenantId),
    index('idx_scorecards_created').on(table.createdAt),
    index('idx_scorecards_overall').on(table.overallScore),
  ]
);
