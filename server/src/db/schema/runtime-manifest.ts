import {
  pgTable,
  varchar,
  integer,
  jsonb,
  timestamp,
  text,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/**
 * agent_runtime_manifests 表(v2.0 Layer 2 编译固化层)。
 *
 * AgentDefinition 发布时 bake 成不可变 RuntimeManifest 落此表。唯一约束 (agentDefinitionId + generation)
 * 保证同一定义同一代际只一个 manifest;baked 后 status='baked' 只读(repository 拒绝 update manifest 字段,
 * 只允许 status 状态流转,见 runtime-manifest-repository)。
 *
 * 不可变性在 domain 层 sealManifest(Object.freeze 递归)保证;DB 层通过 status 流转约束 + manifest jsonb
 * 只在 pending→baked 时写一次保证。改 spec → bumpGeneration → re-bake 新 generation manifest,旧 instance
 * 引用旧 generation(灰度/回滚天然支持)。
 */
export const agentRuntimeManifests = pgTable(
  'agent_runtime_manifests',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    agentDefinitionId: varchar('agent_definition_id', { length: 64 }).notNull(),
    generation: integer('generation').notNull(),
    manifest: jsonb('manifest').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    bakedAt: timestamp('baked_at', { withTimezone: true }),
    errorMsg: text('error_msg'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 唯一约束:同一定义同一代际只一个 manifest(防并发重复 bake)
    uniqueIndex('idx_runtime_manifests_def_gen').on(table.agentDefinitionId, table.generation),
    // 查某定义全部 manifest(版本对比/回滚)
    index('idx_runtime_manifests_def').on(table.agentDefinitionId),
    // 监控 baked/pending/failed 状态
    index('idx_runtime_manifests_status').on(table.status),
  ]
);
