import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateIdentity(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255),
      password_hash TEXT NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      scope VARCHAR(32) NOT NULL DEFAULT 'tenant',
      tenant_id VARCHAR(64),
      display_name VARCHAR(128),
      is_active BOOLEAN NOT NULL DEFAULT true,
      source VARCHAR(32) NOT NULL DEFAULT 'env',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      display_name VARCHAR(128) NOT NULL,
      permissions JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_role_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      assigned_by VARCHAR(64),
      UNIQUE(user_id, role_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_type VARCHAR(32) NOT NULL,
      external_id VARCHAR(256),
      ip_address VARCHAR(64),
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_auth_configs (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      provider_type VARCHAR(32) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      priority INTEGER NOT NULL DEFAULT 0,
      config JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, provider_type)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS external_identities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_type VARCHAR(32) NOT NULL,
      external_id VARCHAR(256) NOT NULL,
      email VARCHAR(255),
      display_name VARCHAR(128),
      avatar_url TEXT,
      raw_claims JSONB,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(provider_type, external_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_providers (
      id SERIAL PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(128) NOT NULL,
      auth_type VARCHAR(32) NOT NULL,
      tenant_id VARCHAR(64),
      enabled BOOLEAN NOT NULL DEFAULT true,
      config JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_authorizations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      external_account_id VARCHAR(256),
      scope VARCHAR(256),
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS credential_secrets (
      id SERIAL PRIMARY KEY,
      authorization_id INTEGER NOT NULL,
      secret_type VARCHAR(32) NOT NULL,
      ciphertext TEXT NOT NULL,
      key_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS credential_leases (
      id SERIAL PRIMARY KEY,
      lease_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
      user_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      scope VARCHAR(256),
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oauth_states (
      id SERIAL PRIMARY KEY,
      state VARCHAR(128) NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      provider_code VARCHAR(64) NOT NULL,
      redirect_uri TEXT NOT NULL,
      code_verifier VARCHAR(128),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ALTER columns
  await db.execute(sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS upstream_token TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ksc_subject VARCHAR(191)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS external_subject VARCHAR(191)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);

  // Indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tenant_auth_configs_tenant ON tenant_auth_configs(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_external_identities_user ON external_identities(user_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_auth_providers_tenant ON auth_providers(tenant_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_cred_leases_user ON credential_leases(user_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_cred_leases_expires ON credential_leases(expires_at)`
  );
}
