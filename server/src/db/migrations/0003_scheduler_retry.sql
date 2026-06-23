-- 调度任务重试 + 死信字段
-- 注:migrate.ts 实际执行 migrations/scheduled-tasks.ts(里面已包含 IF NOT EXISTS 的等价 ALTER)。
-- 本文件作为 Drizzle schema 快照保留,与 .ts migration 双写(参照 0002_add_instance_version.sql 惯例)。

ALTER TABLE "scheduled_tasks" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN IF NOT EXISTS "max_attempts" INTEGER NOT NULL DEFAULT 3;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN IF NOT EXISTS "dead_letter_at" TIMESTAMPTZ;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN IF NOT EXISTS "dead_letter_reason" TEXT;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scheduled_tasks_dead_letter" ON "scheduled_tasks" ("dead_letter_at");
