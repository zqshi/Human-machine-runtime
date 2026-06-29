import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * v2.1 EAOS cockpit 判断子系统：decisions + judgment_records 实体表。
 *
 * 从 cockpit_entities EAV 迁出（破 §12信号1 贫血模型）。DB 级约束 + 可索引。
 * 数据迁移：cockpit_entities.entity_type IN ('decision','judgment_record') → 实体表。
 * 幂等：CREATE/INDEX/INSERT 全 IF NOT EXISTS/ON CONFLICT（§7.2.1#3 + memory migrate.ts 不跑 .sql，
 * tsc/vitest 测不出缺表/缺索引，只有真请求暴露）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 *
 * 字段映射：EAV data jsonb（camelCase）→ 实体表（snake_case）；deadline/responseAt/时间戳 number(ms) → bigint。
 * judgment_record 旧数据可能存 outcome/responseMs（过时字段），迁移按新字段 action/respondedAt/contextSnapshot
 * 提取，缺字段走 NULL/默认（实测无源数据迁 0 行无错）。
 */
export async function migrateCockpitDecisions(db: MigrateDb): Promise<void> {
  // ① decisions 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS decisions (
      id VARCHAR(64) PRIMARY KEY,
      agent_id VARCHAR(64),
      title VARCHAR(256),
      context TEXT,
      recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
      alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
      urgency VARCHAR(16) NOT NULL DEFAULT 'normal',
      deadline BIGINT,
      response_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      user_response TEXT,
      response_at BIGINT,
      impact_scope INTEGER NOT NULL DEFAULT 0,
      downstream_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      downstream_goal_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(response_status)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_decisions_agent ON decisions(agent_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at)`);

  // ② judgment_records 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS judgment_records (
      id VARCHAR(64) PRIMARY KEY,
      decision_id VARCHAR(64),
      source VARCHAR(32) NOT NULL,
      action VARCHAR(32) NOT NULL,
      selected_option_id VARCHAR(64),
      feedback TEXT,
      responded_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_judgment_records_decision ON judgment_records(decision_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_judgment_records_source ON judgment_records(source)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_judgment_records_action ON judgment_records(action)`
  );

  // ③ EAV → decisions 数据迁移（entity_type='decision'）
  await db.execute(sql`
    INSERT INTO decisions (
      id, agent_id, title, context, recommendation, alternatives, urgency,
      deadline, response_status, user_response, response_at, impact_scope,
      downstream_task_ids, downstream_goal_ids, tenant_id, created_at, updated_at
    )
    SELECT
      ce.id,
      ce.data->>'agentId',
      ce.data->>'title',
      ce.data->>'context',
      COALESCE(ce.data->'recommendation', '{}'::jsonb),
      COALESCE(ce.data->'alternatives', '[]'::jsonb),
      COALESCE(ce.data->>'urgency', 'normal'),
      NULLIF(ce.data->>'deadline', '')::bigint,
      COALESCE(ce.data->>'responseStatus', 'pending'),
      ce.data->>'userResponse',
      NULLIF(ce.data->>'responseAt', '')::bigint,
      COALESCE(NULLIF(ce.data->>'impactScope', '')::int, 0),
      COALESCE(ce.data->'downstreamTaskIds', '[]'::jsonb),
      COALESCE(ce.data->'downstreamGoalIds', '[]'::jsonb),
      ce.tenant_id,
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now()),
      now()
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'decision'
    ON CONFLICT (id) DO NOTHING
  `);

  // ④ EAV → judgment_records 数据迁移（entity_type='judgment_record'）
  await db.execute(sql`
    INSERT INTO judgment_records (
      id, decision_id, source, action, selected_option_id, feedback,
      responded_at, created_at, context_snapshot
    )
    SELECT
      ce.id,
      ce.data->>'decisionId',
      COALESCE(ce.data->>'source', 'agent-discovery'),
      COALESCE(ce.data->>'action', 'expired'),
      ce.data->>'selectedOptionId',
      ce.data->>'feedback',
      COALESCE(NULLIF(ce.data->>'respondedAt', '')::bigint, NULLIF(ce.data->>'createdAt', '')::bigint, 0),
      COALESCE(NULLIF(ce.data->>'createdAt', '')::bigint, 0),
      COALESCE(ce.data->'contextSnapshot', '{}'::jsonb)
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'judgment_record'
    ON CONFLICT (id) DO NOTHING
  `);
}
