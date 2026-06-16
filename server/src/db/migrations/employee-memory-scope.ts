import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * 记忆片段三层 scope 迁移：
 * ① fragments 加 scope 列（personal | org(agent共享) | dept_shared(部门跨Agent)）
 * ② fragments 加 department_id 列（仅 dept_shared 有值）
 * ③ 回填：原 userId='__org__' 哨兵行 → scope='org'；其余默认 'personal'（列默认值）
 *
 * 幂等：ADD COLUMN IF NOT EXISTS；UPDATE 仅影响 __org__ 行。可重复执行。
 */
export async function migrateEmployeeMemoryScope(db: MigrateDb): Promise<void> {
  await db.execute(
    sql`ALTER TABLE employee_memory_fragments ADD COLUMN IF NOT EXISTS scope VARCHAR(32) NOT NULL DEFAULT 'personal'`
  );
  await db.execute(
    sql`ALTER TABLE employee_memory_fragments ADD COLUMN IF NOT EXISTS department_id VARCHAR(64)`
  );
  // 原 __org__ 哨兵行回填为 agent 级共享 scope
  await db.execute(
    sql`UPDATE employee_memory_fragments SET scope = 'org' WHERE user_id = '__org__'`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_emf_store_scope_dept ON employee_memory_fragments(memory_store_id, scope, department_id)`
  );
}
