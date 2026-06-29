import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * v2.1 EAOS cockpit 编排子系统：orchestration_chains + escalations + orchestration_agents 实体表。
 *
 * 从 cockpit_entities EAV 迁出（破 §12信号1 贫血模型）。DB 级约束 + 可索引。
 * 数据迁移：cockpit_entities.entity_type IN ('orchestration_chain','escalation','orchestration_agent')
 * → 实体表。幂等：CREATE/INDEX/INSERT 全 IF NOT EXISTS/ON CONFLICT（§7.2.1#3 + memory
 * migrate.ts 不跑 .sql，tsc/vitest 测不出缺表/缺索引，只有真请求暴露）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 *
 * 字段映射：EAV data jsonb（camelCase）→ 实体表（snake_case）；时间戳 number(ms) → timestamptz。
 * 三端点前端不消费（孤儿），实测无源数据应迁 0 行无错。escalation/agent 的 metadata 透传 body 剩余字段
 * （route 无完整固定契约，减去已提取的语义字段后剩余进 metadata，不强加超前列）。
 */
export async function migrateCockpitOrchestration(db: MigrateDb): Promise<void> {
  // ① orchestration_chains 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orchestration_chains (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(256),
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      current_step INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      agent_id VARCHAR(64),
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_orchestration_chains_status ON orchestration_chains(status)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_orchestration_chains_agent ON orchestration_chains(agent_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_orchestration_chains_tenant ON orchestration_chains(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_orchestration_chains_created ON orchestration_chains(created_at)`
  );

  // ② escalations 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS escalations (
      id VARCHAR(64) PRIMARY KEY,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      severity VARCHAR(16),
      trigger_reason TEXT,
      related_task_id VARCHAR(64),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_escalations_tenant ON escalations(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_escalations_created ON escalations(created_at)`
  );

  // ③ orchestration_agents 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orchestration_agents (
      id VARCHAR(64) PRIMARY KEY,
      agent_id VARCHAR(64),
      role VARCHAR(32),
      status VARCHAR(32) NOT NULL DEFAULT 'registered',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      tenant_id VARCHAR(64),
      registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_orchestration_agents_agent ON orchestration_agents(agent_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_orchestration_agents_status ON orchestration_agents(status)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_orchestration_agents_tenant ON orchestration_agents(tenant_id)`
  );

  // ④ EAV → orchestration_chains 数据迁移（entity_type='orchestration_chain'）
  await db.execute(sql`
    INSERT INTO orchestration_chains (
      id, name, steps, current_step, status, agent_id, tenant_id, created_at, updated_at
    )
    SELECT
      ce.id,
      ce.data->>'name',
      COALESCE(ce.data->'steps', '[]'::jsonb),
      COALESCE(NULLIF(ce.data->>'currentStep', '')::int, 0),
      COALESCE(ce.data->>'status', 'active'),
      ce.data->>'agentId',
      ce.tenant_id,
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now()),
      now()
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'orchestration_chain'
    ON CONFLICT (id) DO NOTHING
  `);

  // ⑤ EAV → escalations 数据迁移（entity_type='escalation'）
  // metadata 透传 body 剩余字段：data 减去已提取的语义字段 + 时间戳 + id。
  await db.execute(sql`
    INSERT INTO escalations (
      id, status, severity, trigger_reason, related_task_id, metadata, tenant_id, created_at, updated_at
    )
    SELECT
      ce.id,
      COALESCE(ce.data->>'status', 'open'),
      ce.data->>'severity',
      ce.data->>'triggerReason',
      ce.data->>'relatedTaskId',
      COALESCE(
        ce.data - 'status' - 'severity' - 'triggerReason' - 'relatedTaskId' - 'createdAt' - 'updatedAt' - 'id',
        '{}'::jsonb
      ),
      ce.tenant_id,
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now()),
      now()
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'escalation'
    ON CONFLICT (id) DO NOTHING
  `);

  // ⑥ EAV → orchestration_agents 数据迁移（entity_type='orchestration_agent'）
  // registeredAt 缺失时 fallback createdAt（route POST 仅设 registeredAt，旧数据可能用 createdAt）。
  await db.execute(sql`
    INSERT INTO orchestration_agents (
      id, agent_id, role, status, metadata, tenant_id, registered_at
    )
    SELECT
      ce.id,
      ce.data->>'agentId',
      ce.data->>'role',
      COALESCE(ce.data->>'status', 'registered'),
      COALESCE(
        ce.data - 'agentId' - 'role' - 'status' - 'registeredAt' - 'createdAt' - 'id',
        '{}'::jsonb
      ),
      ce.tenant_id,
      COALESCE(
        to_timestamp(NULLIF(ce.data->>'registeredAt', '')::bigint / 1000.0),
        to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0),
        now()
      )
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'orchestration_agent'
    ON CONFLICT (id) DO NOTHING
  `);
}
