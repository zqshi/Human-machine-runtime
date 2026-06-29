import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * v2.1 EAOS cockpit 战略解码子系统：objectives 实体表。
 *
 * 从 cockpit_entities EAV 迁出（破 §12信号1 贫血模型）。DB 级约束 + 可索引。
 * 数据迁移：cockpit_entities.entity_type='objective' → objectives 表。
 * 幂等：CREATE/INDEX/INSERT 全 IF NOT EXISTS/ON CONFLICT（§7.2.1#3 + memory migrate.ts 不跑 .sql，
 * tsc/vitest 测不出缺表/缺索引，只有真请求暴露）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 *
 * 字段映射：EAV data jsonb（camelCase）→ 实体表（snake_case）；createdAt number(ms) → timestamptz。
 */
export async function migrateCockpitObjectives(db: MigrateDb): Promise<void> {
  // ① objectives 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS objectives (
      id VARCHAR(64) PRIMARY KEY,
      level VARCHAR(8) NOT NULL,
      parent_id VARCHAR(64),
      tenant_id VARCHAR(64),
      title VARCHAR(256),
      description TEXT,
      confidence REAL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objectives_level ON objectives(level)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives(parent_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objectives_tenant ON objectives(tenant_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status)`);

  // ② EAV → objectives 数据迁移（entity_type='objective'）
  // 字段名 camelCase→snake_case，createdAt ms→timestamptz，metrics 直接搬 jsonb
  await db.execute(sql`
    INSERT INTO objectives (
      id, level, parent_id, tenant_id, title, description, confidence,
      status, metrics, created_at, updated_at
    )
    SELECT
      ce.id,
      COALESCE(ce.data->>'level', 'L0'),
      ce.data->>'parentId',
      ce.tenant_id,
      ce.data->>'title',
      ce.data->>'description',
      NULLIF(ce.data->>'confidence', '')::real,
      COALESCE(ce.data->>'status', 'active'),
      COALESCE(ce.data->'metrics', '{}'::jsonb),
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now()),
      now()
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'objective'
    ON CONFLICT (id) DO NOTHING
  `);
}
