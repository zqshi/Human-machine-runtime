import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * 部门实体化迁移：
 * ① 建 departments 表（tenant 内 name/slug 双唯一）
 * ② instances 加 department_id 外键（SET NULL），保留 department 文本列做过渡
 * ③ 回填：现有 instance.department 文本 → 部门实体 → department_id
 *
 * 幂等：CREATE/ALTER/INDEX 全部 IF NOT EXISTS；回填仅处理 department_id IS NULL 的行，
 * 部门按 (tenant_id, name) 去重（ON CONFLICT DO NOTHING）。可重复执行。
 *
 * 注：迁移时 slug 直接取 department 文本（seed 值 finance/human-resources/engineering
 * 已是合法 slug 风格）。运行时新建部门走 service.create（slugify 规范化）。
 */
export async function migrateDepartment(db: MigrateDb): Promise<void> {
  /* ① departments 表 */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS departments (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(128) NOT NULL,
      slug VARCHAR(64) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id)`
  );
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_tenant_slug ON departments(tenant_id, slug)`
  );
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_tenant_name ON departments(tenant_id, name)`
  );

  /* ② instances.department_id */
  await db.execute(sql`
    ALTER TABLE instances
    ADD COLUMN IF NOT EXISTS department_id VARCHAR(64)
    REFERENCES departments(id) ON DELETE SET NULL
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_instances_department ON instances(department_id)`
  );

  /* ③ 回填：按 (tenant_id, department) 去重建部门，再回填 department_id */
  await db.execute(sql`
    INSERT INTO departments (id, tenant_id, name, slug, description, created_at, updated_at)
    SELECT
      'dept_' || replace(gen_random_uuid()::text, '-', ''),
      tenant_id,
      department,
      department,
      '',
      now(),
      now()
    FROM (
      SELECT DISTINCT tenant_id, department
      FROM instances
      WHERE department IS NOT NULL AND department <> '' AND department_id IS NULL
    ) d
    ON CONFLICT (tenant_id, name) DO NOTHING
  `);

  await db.execute(sql`
    UPDATE instances i
    SET department_id = d.id
    FROM departments d
    WHERE i.tenant_id = d.tenant_id
      AND i.department = d.name
      AND i.department_id IS NULL
  `);
}
