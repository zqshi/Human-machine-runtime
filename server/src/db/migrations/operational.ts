import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateOperational(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      scope VARCHAR(32) NOT NULL,
      module VARCHAR(64),
      operation VARCHAR(64) NOT NULL,
      status VARCHAR(32),
      actor_id VARCHAR(128),
      actor_name VARCHAR(128),
      resource_id VARCHAR(128),
      resource_type VARCHAR(64),
      details JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_configs (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS platform_configs (
      key VARCHAR(255) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS openclaw_entities (
      id VARCHAR(64) PRIMARY KEY,
      entity_type VARCHAR(32) NOT NULL,
      tenant_id VARCHAR(64),
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(256),
      type VARCHAR(32),
      read INTEGER NOT NULL DEFAULT 0,
      escalated INTEGER NOT NULL DEFAULT 0,
      snoozed_until TIMESTAMPTZ,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_channels (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128),
      type VARCHAR(32),
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tool_configs (
      id VARCHAR(64) PRIMARY KEY,
      category VARCHAR(32) NOT NULL,
      name VARCHAR(128),
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(256) NOT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'personal',
      owner_id VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      description TEXT,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_profiles (
      id VARCHAR(64) PRIMARY KEY,
      instance_id VARCHAR(64) NOT NULL,
      tenant_id VARCHAR(64) NOT NULL,
      display_name VARCHAR(128),
      avatar TEXT,
      know_me TEXT,
      skills_digest TEXT,
      personality TEXT,
      settings JSONB DEFAULT '{}',
      milestones JSONB DEFAULT '[]',
      synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Indexes
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_openclaw_entities_type ON openclaw_entities(entity_type)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_openclaw_entities_tenant ON openclaw_entities(tenant_id)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_configs_category ON tool_configs(category)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_profiles_instance ON agent_profiles(instance_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_profiles_tenant ON agent_profiles(tenant_id)`
  );
}
