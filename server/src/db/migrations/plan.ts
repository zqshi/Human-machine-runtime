import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migratePlan(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS service_plans (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      slug VARCHAR(64) NOT NULL UNIQUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      is_default BOOLEAN NOT NULL DEFAULT false,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      quota_template JSONB DEFAULT '{}',
      feature_template JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_service_plans_slug ON service_plans(slug)`);
}
