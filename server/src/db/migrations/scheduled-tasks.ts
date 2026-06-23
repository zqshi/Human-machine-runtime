import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

export async function migrateScheduledTasks(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      job_type VARCHAR(32) NOT NULL,
      job_payload JSONB NOT NULL,
      schedule_type VARCHAR(16) NOT NULL,
      cron_expr VARCHAR(64),
      interval_seconds INTEGER,
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      next_run_at TIMESTAMPTZ,
      last_run_at TIMESTAMPTZ,
      last_run_status VARCHAR(16),
      last_error TEXT,
      created_by VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scheduled_task_runs (
      id VARCHAR(64) PRIMARY KEY,
      task_id VARCHAR(64) NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      trigger_type VARCHAR(16) NOT NULL,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      duration_ms INTEGER,
      conclusion TEXT,
      output_payload JSONB,
      error_message TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(is_enabled)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_job_type ON scheduled_tasks(job_type)`
  );
  // 重试与死信字段(v1.1 投产可用性补强)
  await db.execute(
    sql`ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0`
  );
  await db.execute(
    sql`ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3`
  );
  await db.execute(
    sql`ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMPTZ`
  );
  await db.execute(
    sql`ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_dead_letter ON scheduled_tasks(dead_letter_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_task ON scheduled_task_runs(task_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_status ON scheduled_task_runs(status)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_created ON scheduled_task_runs(created_at)`
  );
}
