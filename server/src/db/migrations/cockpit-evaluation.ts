import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * v2.1 EAOS cockpit 评估子系统：evaluation_metrics + scorecards 实体表。
 *
 * 从 cockpit_entities EAV 迁出（破 §12信号1 贫血模型）。DB 级约束 + 可索引。
 * 数据迁移：cockpit_entities.entity_type IN ('evaluation_metric','scorecard')
 * → 实体表。幂等：CREATE/INDEX/INSERT 全 IF NOT EXISTS/ON CONFLICT（§7.2.1#3 + memory
 * migrate.ts 不跑 .sql，tsc/vitest 测不出缺表/缺索引，只有真请求暴露）。
 * cockpitEntities 保留给非五子系统（notification 等）继续用，不 drop。
 *
 * 字段映射：EAV data jsonb（camelCase）→ 实体表（snake_case）；时间戳 number(ms) → timestamptz。
 * metadata 透传 body 剩余字段（route 无完整固定契约，减去已提取的语义字段后剩余进 metadata，不强加超前列）。
 * scorecard.overallScore 信任 EAV 旧值（原 route 算的合法值，fallback 0），新数据走 domain 不变式。
 */
export async function migrateCockpitEvaluation(db: MigrateDb): Promise<void> {
  // ① evaluation_metrics 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS evaluation_metrics (
      id VARCHAR(64) PRIMARY KEY,
      dimension VARCHAR(32) NOT NULL DEFAULT 'human',
      score INTEGER NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_evaluation_metrics_dimension ON evaluation_metrics(dimension)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_evaluation_metrics_tenant ON evaluation_metrics(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_evaluation_metrics_created ON evaluation_metrics(created_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_evaluation_metrics_score ON evaluation_metrics(score)`
  );

  // ② scorecards 表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scorecards (
      id VARCHAR(64) PRIMARY KEY,
      scores JSONB NOT NULL DEFAULT '[]'::jsonb,
      overall_score INTEGER NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_scorecards_tenant ON scorecards(tenant_id)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scorecards_created ON scorecards(created_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scorecards_overall ON scorecards(overall_score)`
  );

  // ③ EAV → evaluation_metrics 数据迁移（entity_type='evaluation_metric'）
  // metadata 透传 body 剩余字段：data 减去已提取的语义字段 + 时间戳 + id。
  // score 非 number/缺失 fallback 0（domain 不变式，防脏值）。
  await db.execute(sql`
    INSERT INTO evaluation_metrics (
      id, dimension, score, metadata, tenant_id, created_at, updated_at
    )
    SELECT
      ce.id,
      COALESCE(NULLIF(ce.data->>'dimension', '')::varchar, 'human'),
      COALESCE(NULLIF(ce.data->>'score', '')::int, 0),
      COALESCE(
        ce.data - 'dimension' - 'score' - 'createdAt' - 'updatedAt' - 'id',
        '{}'::jsonb
      ),
      ce.tenant_id,
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now()),
      COALESCE(to_timestamp(NULLIF(ce.data->>'updatedAt', '')::bigint / 1000.0), now())
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'evaluation_metric'
    ON CONFLICT (id) DO NOTHING
  `);

  // ④ EAV → scorecards 数据迁移（entity_type='scorecard'）
  // scores 缺失 fallback []；overallScore 信任原 route 算的旧值（fallback 0），新数据走 domain 不变式。
  await db.execute(sql`
    INSERT INTO scorecards (
      id, scores, overall_score, metadata, tenant_id, created_at, updated_at
    )
    SELECT
      ce.id,
      COALESCE(ce.data->'scores', '[]'::jsonb),
      COALESCE(NULLIF(ce.data->>'overallScore', '')::int, 0),
      COALESCE(
        ce.data - 'scores' - 'overallScore' - 'createdAt' - 'id',
        '{}'::jsonb
      ),
      ce.tenant_id,
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now()),
      COALESCE(to_timestamp(NULLIF(ce.data->>'createdAt', '')::bigint / 1000.0), now())
    FROM cockpit_entities ce
    WHERE ce.entity_type = 'scorecard'
    ON CONFLICT (id) DO NOTHING
  `);
}
