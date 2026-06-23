import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * billing 限界上下文 schema 同步(.ts 版本,不走 .sql)。
 *
 * 与 schema/billing.ts 一一对应:CREATE TABLE IF NOT EXISTS 幂等,
 * 已存在的表/索引跳过,允许旧库平滑升级。
 */
export async function migrateBilling(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS billing_events (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      type VARCHAR(32) NOT NULL,
      amount NUMERIC(12, 4) NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'USD',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_created
      ON billing_events(tenant_id, created_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_type
      ON billing_events(tenant_id, type)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS billing_accounts (
      tenant_id VARCHAR(64) PRIMARY KEY,
      balance NUMERIC(12, 4) NOT NULL DEFAULT 0,
      currency VARCHAR(8) NOT NULL DEFAULT 'USD',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS billing_invoices (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL,
      period_start TIMESTAMPTZ NOT NULL,
      period_end TIMESTAMPTZ NOT NULL,
      amount NUMERIC(12, 4) NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'USD',
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant_period
      ON billing_invoices(tenant_id, period_start)
  `);
}
