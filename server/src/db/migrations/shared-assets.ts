import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateSharedAssets(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(64) PRIMARY KEY,
      room_id VARCHAR(128),
      type VARCHAR(32) NOT NULL DEFAULT 'doc',
      title VARCHAR(512) NOT NULL,
      content JSONB DEFAULT '{}',
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      category_id VARCHAR(64),
      department_id VARCHAR(64),
      owner_id VARCHAR(128) NOT NULL,
      permissions JSONB DEFAULT '[]',
      created_by VARCHAR(128) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      published_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ,
      reviewed_by VARCHAR(128),
      review_comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_versions (
      id VARCHAR(64) PRIMARY KEY,
      document_id VARCHAR(64) NOT NULL,
      version_number INTEGER NOT NULL,
      title VARCHAR(512) NOT NULL,
      edited_by VARCHAR(128) NOT NULL,
      content_snapshot JSONB,
      status VARCHAR(32) NOT NULL DEFAULT 'auto',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS knowledge_audits (
      id VARCHAR(64) PRIMARY KEY,
      operation_type VARCHAR(64) NOT NULL,
      operator_id VARCHAR(128) NOT NULL,
      operator_name VARCHAR(128) NOT NULL,
      target_id VARCHAR(128) NOT NULL,
      target_name VARCHAR(512),
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS skill_reports (
      id VARCHAR(64) PRIMARY KEY,
      asset_type VARCHAR(32) NOT NULL DEFAULT 'skill',
      source_tenant_id VARCHAR(64) NOT NULL,
      source_instance_id VARCHAR(64) NOT NULL,
      source_skill_id VARCHAR(64),
      name VARCHAR(256) NOT NULL,
      description TEXT,
      content_ref TEXT,
      tags JSONB DEFAULT '[]',
      version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
      status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
      required_approvals INTEGER NOT NULL DEFAULT 1,
      approvals JSONB DEFAULT '[]',
      review_history JSONB DEFAULT '[]',
      reviewed_by VARCHAR(128),
      reviewed_at TIMESTAMPTZ,
      reject_reason TEXT,
      sla_due_at TIMESTAMPTZ,
      review_escalation_level INTEGER NOT NULL DEFAULT 0,
      last_escalated_at TIMESTAMPTZ,
      escalation_history JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS shared_assets (
      id VARCHAR(64) PRIMARY KEY,
      asset_type VARCHAR(32) NOT NULL DEFAULT 'skill',
      source_report_id VARCHAR(64) NOT NULL,
      source_tenant_id VARCHAR(64) NOT NULL,
      source_instance_id VARCHAR(64) NOT NULL,
      name VARCHAR(256) NOT NULL,
      description TEXT,
      content_ref TEXT,
      tags JSONB DEFAULT '[]',
      version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      published_by VARCHAR(128) NOT NULL,
      published_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS asset_bindings (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      skill_id VARCHAR(64),
      asset_id VARCHAR(64),
      asset_type VARCHAR(32) NOT NULL DEFAULT 'skill',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_by VARCHAR(128) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_reviews (
      id SERIAL PRIMARY KEY,
      app_id VARCHAR(64) NOT NULL,
      xspace_app_id VARCHAR(64),
      tenant_id VARCHAR(64) NOT NULL,
      submitter VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      reviewer VARCHAR(128),
      review_note TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_mcp_policies (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      mcp_group_id VARCHAR(64) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      max_calls_per_day INTEGER,
      requires_approval BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, mcp_group_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mcp_tool_usage (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      tool_name VARCHAR(128) NOT NULL,
      user_id VARCHAR(128),
      instance_id VARCHAR(64),
      called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      duration_ms INTEGER,
      status VARCHAR(32) NOT NULL DEFAULT 'success',
      error_message TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_catalog (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      icon VARCHAR(64) NOT NULL,
      icon_color VARCHAR(16) NOT NULL DEFAULT '#007AFF',
      category VARCHAR(64) NOT NULL,
      description TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      sort_order INTEGER NOT NULL DEFAULT 0,
      visible BOOLEAN NOT NULL DEFAULT true,
      tenant_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ALTER documents for WeKnora integration
  await db.execute(
    sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) REFERENCES tenants(id)`
  );
  await db.execute(
    sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS wk_knowledge_id VARCHAR(128)`
  );
  await db.execute(
    sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS wk_sync_status VARCHAR(32) DEFAULT 'pending'`
  );

  // Indexes
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_app_reviews_tenant ON app_reviews(tenant_id)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_app_reviews_status ON app_reviews(status)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tenant_mcp_policies_tenant ON tenant_mcp_policies(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_mcp_usage_tenant ON mcp_tool_usage(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_mcp_usage_called_at ON mcp_tool_usage(called_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_app_catalog_category ON app_catalog(category)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_app_catalog_tenant ON app_catalog(tenant_id)`
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_documents_wk_sync ON documents(wk_sync_status)`
  );
}
