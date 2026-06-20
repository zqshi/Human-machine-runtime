import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateTenant(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      slug VARCHAR(64) NOT NULL UNIQUE,
      plan VARCHAR(32) NOT NULL DEFAULT 'free',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      industry VARCHAR(64),
      company_size VARCHAR(32),
      contact_name VARCHAR(64),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(32),
      description TEXT,
      quotas JSONB DEFAULT '{}',
      features JSONB DEFAULT '{}',
      model_access JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_quotas (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      max_instances INTEGER NOT NULL DEFAULT 10,
      max_cpu_cores INTEGER NOT NULL DEFAULT 16,
      max_memory_gb REAL NOT NULL DEFAULT 16.0,
      max_storage_gb REAL NOT NULL DEFAULT 100.0,
      max_gpu_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS instances (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      source VARCHAR(32) NOT NULL DEFAULT 'api',
      type VARCHAR(32) NOT NULL DEFAULT 'openclaw',
      state VARCHAR(32) NOT NULL DEFAULT 'requested',
      creator VARCHAR(128),
      enterprise_user_id VARCHAR(128),
      employee_no VARCHAR(32),
      employee_id VARCHAR(64),
      email VARCHAR(255),
      job_code VARCHAR(64),
      job_title VARCHAR(128),
      department VARCHAR(128),
      matrix_room_id VARCHAR(128),
      permission_template_id VARCHAR(64),
      permission_template JSONB,
      resources JSONB DEFAULT '{}',
      runtime JSONB DEFAULT '{}',
      policy JSONB DEFAULT '{}',
      approval_policy JSONB DEFAULT '{}',
      request_id VARCHAR(64),
      last_error TEXT,
      version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ALTER columns
  await db.execute(sql`ALTER TABLE instances ADD COLUMN IF NOT EXISTS policy JSONB DEFAULT '{}'`);
  await db.execute(
    sql`ALTER TABLE instances ADD COLUMN IF NOT EXISTS approval_policy JSONB DEFAULT '{}'`
  );
  await db.execute(
    sql`ALTER TABLE instances ADD COLUMN IF NOT EXISTS farm_instance_id VARCHAR(128)`
  );
  await db.execute(sql`ALTER TABLE instances ADD COLUMN IF NOT EXISTS farm_pod_name VARCHAR(128)`);
  await db.execute(sql`ALTER TABLE instances ADD COLUMN IF NOT EXISTS farm_namespace VARCHAR(128)`);
  await db.execute(
    sql`ALTER TABLE instances ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0`
  );
}
