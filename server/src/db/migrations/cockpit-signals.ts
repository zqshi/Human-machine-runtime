import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * v2.1 EAOS cockpit 感知子系统：emergent_signals + patterns 实体表。
 *
 * 从 cockpit_entities EAV 迁出（破 §12信号1 贫血模型）。DB 级约束 + 可索引。
 * 数据迁移：cockpit_entities.entity_type='emergent_signal'/'pattern'/'knowledge_pattern' → 新表。
 * 幂等：CREATE/INDEX/INSERT 全 IF NOT EXISTS/ON CONFLICT（§7.2.1#3 + memory migrate.ts 不跑 .sql，
 * tsc/vitest 测不出缺表/缺索引，只有真请求暴露）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 *
 * 字段映射：EAV data jsonb（camelCase）→ 实体表（snake_case）；createdAt number(ms) → timestamptz。
 */
export async function migrateCockpitSignals(db: MigrateDb): Promise<void> {
  // ① emergent_signals 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS emergent_signals (
      id VARCHAR(64) PRIMARY KEY,
      pattern_id VARCHAR(64),
      correlated_signal_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      pattern TEXT,
      severity VARCHAR(16) NOT NULL DEFAULT 'medium',
      suggested_action TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'detected',
      detected_at BIGINT,
      resolved_at BIGINT,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_emergent_signals_severity ON emergent_signals(severity)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_emergent_signals_status ON emergent_signals(status)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_emergent_signals_detected ON emergent_signals(detected_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_emergent_signals_tenant ON emergent_signals(tenant_id)`
  );

  // ② patterns 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS patterns (
      id VARCHAR(64) PRIMARY KEY,
      pattern_type VARCHAR(32) NOT NULL DEFAULT 'pattern',
      pattern TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type)`);

  // ③ EAV → emergent_signals 数据迁移（entity_type='emergent_signal'）
  // 字段名 camelCase→snake_case，createdAt ms→timestamptz，detectedAt/resolvedAt 存 ms bigint
  await db.execute(sql`
    INSERT INTO emergent_signals (
      id, pattern_id, correlated_signal_ids, pattern, severity, suggested_action,
      status, detected_at, resolved_at, tenant_id, created_at, updated_at
    )
    SELECT
      ce.id,
      ce.data->>'patternId',
      COALESCE(ce.data->'correlatedSignalIds', '[]'::jsonb),
      ce.data->>'pattern',
      COALESCE(ce.data->>'severity', 'medium'),
      ce.data->>'suggestedAction',
      COALESCE(ce.data->>'status', 'detected'),
      NULLIF(ce.data->>'detectedAt', '')::bigint,
      NULLIF(ce.data->>'resolvedAt', '')::bigint,
      ce.tenant_id,
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now()),
      now()
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'emergent_signal'
    ON CONFLICT (id) DO NOTHING
  `);

  // ④ EAV → patterns 数据迁移（pattern + knowledge_pattern 合并，patternType 区分）
  await db.execute(sql`
    INSERT INTO patterns (id, pattern_type, pattern, data, tenant_id, created_at)
    SELECT
      ce.id,
      CASE ce.entity_type WHEN 'knowledge_pattern' THEN 'knowledge_pattern' ELSE 'pattern' END,
      ce.data->>'pattern',
      COALESCE(ce.data - 'id', '{}'::jsonb),
      ce.tenant_id,
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now())
    FROM cockpit_entities ce
    WHERE ce.entity_type IN ('pattern', 'knowledge_pattern')
    ON CONFLICT (id) DO NOTHING
  `);
}
