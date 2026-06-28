import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * v2.0 Layer 2 编译固化层:agent_runtime_manifests 表。
 *
 * AgentDefinition 发布时 bake 成不可变 RuntimeManifest 落此表。运行时 harness 读 manifest 拿声明态产物
 * (systemPrompt/guardrails/tools/skills/quota/route),不再每次 dispatch 动态查 DB(消除运行时漂移)。
 *
 * 幂等:CREATE/INDEX 全 IF NOT EXISTS,可重复执行(§7.2.1 第3条 + memory migrate.ts 不跑 .sql,
 * tsc/vitest 测不出缺表/缺索引,只有真请求暴露)。
 *
 * 唯一约束 (agent_definition_id, generation):同一定义同一代际只一个 manifest,防并发重复 bake。
 */
export async function migrateRuntimeManifests(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_runtime_manifests (
      id VARCHAR(64) PRIMARY KEY,
      agent_definition_id VARCHAR(64) NOT NULL,
      generation INTEGER NOT NULL,
      manifest JSONB NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      baked_at TIMESTAMPTZ,
      error_msg TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // 唯一约束:同一定义同一代际只一个 manifest
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_manifests_def_gen
    ON agent_runtime_manifests(agent_definition_id, generation)
  `);
  // 查某定义全部 manifest(版本对比/回滚)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_runtime_manifests_def
    ON agent_runtime_manifests(agent_definition_id)
  `);
  // 监控 baked/pending/failed 状态
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_runtime_manifests_status
    ON agent_runtime_manifests(status)
  `);
}
