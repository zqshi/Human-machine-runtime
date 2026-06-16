import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateObservability(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS token_usage_snapshots (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      user_uid VARCHAR(128),
      model VARCHAR(128),
      time_bucket TIMESTAMPTZ NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      request_count INTEGER NOT NULL DEFAULT 0,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS instance_health_snapshots (
      id SERIAL PRIMARY KEY,
      instance_id VARCHAR(64) NOT NULL,
      tenant_id VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL,
      cpu_usage REAL,
      memory_usage REAL,
      uptime_seconds INTEGER,
      last_activity_at TIMESTAMPTZ,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      wk_knowledge_base_id VARCHAR(128) NOT NULL,
      name VARCHAR(256) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type VARCHAR(32) NOT NULL DEFAULT 'document',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      embedding_model_id VARCHAR(128),
      chunking_config JSONB DEFAULT '{}',
      retrieval_config JSONB DEFAULT '{}',
      document_count INTEGER NOT NULL DEFAULT 0,
      bound_instance_ids JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id VARCHAR(64) PRIMARY KEY,
      knowledge_base_id VARCHAR(64) NOT NULL,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      wk_knowledge_id VARCHAR(128) NOT NULL,
      dcf_document_id VARCHAR(64),
      title VARCHAR(512) NOT NULL,
      source_type VARCHAR(32) NOT NULL DEFAULT 'manual',
      parse_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      chunk_count INTEGER NOT NULL DEFAULT 0,
      file_size INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS weknora_tenant_mappings (
      id VARCHAR(64) PRIMARY KEY,
      dcf_tenant_id VARCHAR(64) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
      wk_tenant_id VARCHAR(128) NOT NULL,
      wk_user_id VARCHAR(128) NOT NULL,
      wk_api_key TEXT NOT NULL,
      wk_base_url VARCHAR(512),
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      default_kb_id VARCHAR(128),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quota_alert_rules (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      resource_type VARCHAR(32) NOT NULL,
      threshold_pct INTEGER NOT NULL,
      severity VARCHAR(16) NOT NULL DEFAULT 'warning',
      notify_channels JSONB DEFAULT '[]',
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quota_usage_snapshots (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      resource_type VARCHAR(32) NOT NULL,
      current_value REAL NOT NULL,
      limit_value REAL NOT NULL,
      usage_pct REAL NOT NULL,
      measured_at TIMESTAMPTZ NOT NULL,
      metadata JSONB DEFAULT '{}'
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quota_alert_events (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      rule_id INTEGER REFERENCES quota_alert_rules(id) ON DELETE SET NULL,
      resource_type VARCHAR(32) NOT NULL,
      current_pct REAL NOT NULL,
      threshold_pct INTEGER NOT NULL,
      severity VARCHAR(16) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ
    )
  `);

  // Indexes
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_token_usage_tenant ON token_usage_snapshots(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_token_usage_bucket ON token_usage_snapshots(time_bucket)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_instance_health_instance ON instance_health_snapshots(instance_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_instance_health_tenant ON instance_health_snapshots(tenant_id)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_tenant ON knowledge_bases(tenant_id)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_kb_wk_id ON knowledge_bases(wk_knowledge_base_id)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_status ON knowledge_bases(status)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_ke_kb ON knowledge_entries(knowledge_base_id)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ke_tenant ON knowledge_entries(tenant_id)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_ke_dcf_doc ON knowledge_entries(dcf_document_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_wk_mapping_tenant ON weknora_tenant_mappings(dcf_tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_wk_mapping_status ON weknora_tenant_mappings(status)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_quota_alert_rules_tenant ON quota_alert_rules(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_quota_usage_snapshots_tenant ON quota_usage_snapshots(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_quota_usage_snapshots_measured ON quota_usage_snapshots(measured_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_quota_alert_events_tenant ON quota_alert_events(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_quota_alert_events_status ON quota_alert_events(status)`
  );
}
