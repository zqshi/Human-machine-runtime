import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateToolRegistry(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tool_sources (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      source_type VARCHAR(32) NOT NULL,
      name VARCHAR(256) NOT NULL,
      description TEXT,
      spec_url TEXT,
      spec_content TEXT,
      spec_version VARCHAR(16),
      db_type VARCHAR(32),
      db_host TEXT,
      db_port INTEGER,
      db_name VARCHAR(128),
      db_schema_name VARCHAR(128) DEFAULT 'public',
      credential_id VARCHAR(64),
      gateway_type VARCHAR(32),
      gateway_url TEXT,
      gateway_credential_id VARCHAR(64),
      mcp_transport VARCHAR(32),
      mcp_endpoint TEXT,
      sync_strategy VARCHAR(32) DEFAULT 'manual',
      sync_interval_min INTEGER,
      last_synced_at TIMESTAMPTZ,
      last_sync_error TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      tool_count INTEGER NOT NULL DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_by VARCHAR(128),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tool_definitions (
      id VARCHAR(64) PRIMARY KEY,
      source_id VARCHAR(64) NOT NULL REFERENCES tool_sources(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL,
      name VARCHAR(256) NOT NULL,
      operation_id VARCHAR(256),
      method VARCHAR(16),
      path VARCHAR(512),
      summary TEXT,
      description TEXT,
      input_schema JSONB,
      output_schema JSONB,
      auth_method VARCHAR(32) DEFAULT 'none',
      execution_type VARCHAR(32) NOT NULL,
      execution_config JSONB NOT NULL DEFAULT '{}',
      tags JSONB DEFAULT '[]',
      version VARCHAR(32) DEFAULT '1.0.0',
      enabled BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      call_count INTEGER NOT NULL DEFAULT 0,
      last_called_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tool_instances (
      id VARCHAR(64) PRIMARY KEY,
      definition_id VARCHAR(64) NOT NULL REFERENCES tool_definitions(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL,
      instance_id VARCHAR(64),
      credential_id VARCHAR(64),
      display_name VARCHAR(256),
      policy JSONB DEFAULT '{}',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tool_call_logs (
      id VARCHAR(64) PRIMARY KEY,
      definition_id VARCHAR(64) NOT NULL,
      instance_id VARCHAR(64),
      tenant_id VARCHAR(64) NOT NULL,
      caller_id VARCHAR(128),
      input_params JSONB,
      output_result JSONB,
      duration_ms INTEGER,
      status VARCHAR(32) NOT NULL DEFAULT 'success',
      error_message TEXT,
      called_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Indexes
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_sources_tenant ON tool_sources(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_sources_type ON tool_sources(source_type)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tool_sources_status ON tool_sources(status)`);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_definitions_source ON tool_definitions(source_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_definitions_tenant ON tool_definitions(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_definitions_status ON tool_definitions(status)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_definitions_name ON tool_definitions(name)`
  );

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_instances_definition ON tool_instances(definition_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_instances_tenant ON tool_instances(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_instances_instance ON tool_instances(instance_id)`
  );

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_call_logs_definition ON tool_call_logs(definition_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_call_logs_tenant ON tool_call_logs(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_call_logs_called_at ON tool_call_logs(called_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tool_call_logs_status ON tool_call_logs(status)`
  );
}
