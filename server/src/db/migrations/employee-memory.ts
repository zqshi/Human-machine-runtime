import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * 数字员工记忆三表建表：stores / fragments / rules。
 *
 * 修复历史缺口：schema 里本就有这 3 张表，但 migrations 目录此前只有
 * employee-memory-scope.ts（给老库补 scope/department_id 列的 ALTER），
 * 缺失全新库的建表迁移，导致全新库 migrate 时 ALTER 一张不存在的表而失败。
 *
 * 本迁移补齐建表（fragments 直接含 scope 列）。与 scope 迁移配合：
 * - 全新库：表已含 scope 列 → scope 迁移的 ADD COLUMN IF NOT EXISTS 自动跳过；
 * - 老库：CREATE TABLE IF NOT EXISTS 自动跳过 → scope 迁移照常补列。
 * 全程幂等。
 *
 * 外键依赖：tenants、instances（均由 migrateTenant 在更早步骤创建）。
 */
export async function migrateEmployeeMemory(db: MigrateDb): Promise<void> {
  // 1) stores 必须先建，fragments/rules 通过外键引用它
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_memory_stores (
      id VARCHAR(64) PRIMARY KEY,
      instance_id VARCHAR(64) NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(128) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      retrieval_config JSONB DEFAULT '{}',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      total_fragments INTEGER NOT NULL DEFAULT 0,
      total_profiles INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 2) fragments —— 含 scope / department_id 列（与 scope 迁移的目标列一致）
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_memory_fragments (
      id VARCHAR(64) PRIMARY KEY,
      memory_store_id VARCHAR(64) NOT NULL REFERENCES employee_memory_stores(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id VARCHAR(128) NOT NULL,
      department_id VARCHAR(64),
      type VARCHAR(32) NOT NULL DEFAULT 'fact',
      scope VARCHAR(32) NOT NULL DEFAULT 'personal',
      content TEXT NOT NULL,
      source VARCHAR(32) NOT NULL DEFAULT 'manual',
      importance INTEGER NOT NULL DEFAULT 5,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 3) rules
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_memory_rules (
      id VARCHAR(64) PRIMARY KEY,
      memory_store_id VARCHAR(64) NOT NULL REFERENCES employee_memory_stores(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      rule_type VARCHAR(32) NOT NULL DEFAULT 'fragment_rule',
      name VARCHAR(128) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      trigger JSONB DEFAULT '{}',
      action JSONB DEFAULT '{}',
      priority INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 4) 索引（与 schema 定义一一对应；scope 迁移里的 idx_emf_store_scope_dept 会因 IF NOT EXISTS 自动跳过）
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ems_instance ON employee_memory_stores(instance_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ems_tenant ON employee_memory_stores(tenant_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ems_status ON employee_memory_stores(status)`);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_emf_store_user ON employee_memory_fragments(memory_store_id, user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_emf_type ON employee_memory_fragments(type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_emf_expires ON employee_memory_fragments(expires_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_emf_store_scope_dept ON employee_memory_fragments(memory_store_id, scope, department_id)`);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_emr_store_type ON employee_memory_rules(memory_store_id, rule_type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_emr_tenant ON employee_memory_rules(tenant_id)`);
}
