import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * Agent 定义 CRD 迁移(v1.3)：
 * ① 建 agent_definitions 表(声明式 spec:generation/sandboxTemplate/resourceLimits/
 *    workspaceStrategy/boundTools/boundSkills/modelConfig)
 * ② instances 加 agent_definition_id + agent_generation(spec 世代引用)
 *
 * 幂等:CREATE/ALTER/INDEX 全 IF NOT EXISTS。可重复执行。
 *
 * 注:agent_definitions 与 agent_profiles 区分——前者是声明式 spec(本地维护),
 * 后者是人格展示档案(从 portal 同步)。instance 通过 agentDefinitionId 引用本表。
 */
export async function migrateAgentDefinition(db: MigrateDb): Promise<void> {
  /* ① agent_definitions 表 */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_definitions (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(128) NOT NULL,
      generation INTEGER NOT NULL DEFAULT 1,
      sandbox_template VARCHAR(64) NOT NULL DEFAULT 'basic',
      resource_limits JSONB NOT NULL,
      workspace_strategy JSONB NOT NULL DEFAULT '{"type":"pvc","size":"2Gi"}'::jsonb,
      bound_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
      bound_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
      model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      description VARCHAR(512),
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_definitions_tenant ON agent_definitions(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_definitions_name ON agent_definitions(name)`
  );

  /* ② instances 加 spec 引用字段(可空,向后兼容;现有实例不引用 CRD 仍可用) */
  await db.execute(sql`
    ALTER TABLE instances
      ADD COLUMN IF NOT EXISTS agent_definition_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS agent_generation INTEGER
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_instances_agent_definition ON instances(agent_definition_id)`
  );

  /* ③ v1.9:agent_definitions 声明态扩展(persona/bound_knowledge/runtime),幂等加列。
   *    旧数据无此列 → 加列后 persona={}、bound_knowledge=[]、runtime={"runtimeType":"claude"},
   *    旧实例未关联 CRD 走默认,不阻断(向后兼容)。 */
  await db.execute(
    sql`ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS persona JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await db.execute(
    sql`ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS bound_knowledge JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await db.execute(
    sql`ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS runtime JSONB NOT NULL DEFAULT '{"runtimeType":"claude"}'::jsonb`
  );

  // v2.0 计划外·C16:RAG 召回策略列(intent|always|never,默认 intent)。幂等加列。
  await db.execute(
    sql`ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS rag_recall_policy VARCHAR(16) NOT NULL DEFAULT 'intent'`
  );

  // T60: openclaw→cockpit 命名中性化(历史 runtime.runtimeType 值迁移,幂等)
  await db.execute(sql`
    UPDATE agent_definitions
    SET runtime = jsonb_set(runtime, '{runtimeType}', '"cockpit"'::jsonb)
    WHERE runtime->>'runtimeType' = 'openclaw'
  `);
}
