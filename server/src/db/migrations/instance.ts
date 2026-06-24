import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * Instance 表迁移(v1.8 reconcile 解耦)：
 * instances 加 desired_state(期望态)+ spec_generation(spec 世代)。
 *
 * 背景:v1.8 将"声明态(desired)"与"运行态(actual)"分离——state 改为 actual only,
 * desiredState 独立表达期望;reconciler 按 desired→actual diff 增量调和(非整机 rebuild)。
 * specGeneration 覆盖 resources/policy/agentDefinition 整体维度(区别于 version 乐观锁与
 * agent_generation 仅 agent 定义维度),声明变更自增,驱动 reconcile 检测 spec drift。
 *
 * 幂等:ADD COLUMN/INDEX/UPDATE 全可重复执行。spec_generation 旧行回填 0;
 * desired_state 先按默认 'requested' 回填,再一次性对齐为当前 state(声明=运行,无 drift)。
 *
 * 注:migrate.ts 只跑 .ts migration,不跑 .sql(见 memory: migrate.ts 不跑 .sql),
 * 因此仅改 schema.ts 不够,必须在此同步——否则 DB 缺列,运行时 SELECT 报错(tsc/vitest 测不出)。
 */
export async function migrateInstance(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    ALTER TABLE instances
      ADD COLUMN IF NOT EXISTS desired_state VARCHAR(32) NOT NULL DEFAULT 'requested',
      ADD COLUMN IF NOT EXISTS spec_generation INTEGER NOT NULL DEFAULT 0
  `);
  // 回填:v1.8 前的旧实例无 desired 概念,ALTER 默认回填 'requested' 与运行态(running/creating 等)不符,
  // 会导致 reconcile decide 失效。一次性把回填默认值对齐为当前 state(声明=运行,无 drift)。
  // 幂等:WHERE 限定 desired 仍为回填默认 'requested' 且 state 非 requested,对齐后不再匹配。
  await db.execute(sql`
    UPDATE instances SET desired_state = state WHERE desired_state = 'requested' AND state <> 'requested'
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_instances_desired_state ON instances(desired_state)`
  );
}
