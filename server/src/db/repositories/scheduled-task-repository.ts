import { eq, desc, and, lte, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { scheduledTasks, scheduledTaskRuns } from '../schema/scheduled-tasks.js';

export interface ScheduledTaskRow {
  id: string;
  name: string;
  description: string | null;
  jobType: string;
  jobPayload: unknown;
  scheduleType: string;
  cronExpr: string | null;
  intervalSeconds: number | null;
  timezone: string;
  isEnabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastError: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledTaskRunRow {
  id: string;
  taskId: string;
  status: string;
  triggerType: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  conclusion: string | null;
  outputPayload: unknown;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: Date;
}

export class ScheduledTaskRepository {
  constructor(private db: Database) {}

  /* ──── Tasks ──── */

  async listTasks(filter?: { isEnabled?: boolean; jobType?: string }): Promise<ScheduledTaskRow[]> {
    const conditions = [];
    if (filter?.isEnabled !== undefined) {
      conditions.push(eq(scheduledTasks.isEnabled, filter.isEnabled));
    }
    if (filter?.jobType) {
      conditions.push(eq(scheduledTasks.jobType, filter.jobType));
    }
    return this.db
      .select()
      .from(scheduledTasks)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(scheduledTasks.createdAt));
  }

  async getTask(id: string): Promise<ScheduledTaskRow | null> {
    const [row] = await this.db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, id))
      .limit(1);
    return (row as ScheduledTaskRow) ?? null;
  }

  async createTask(data: {
    id: string;
    name: string;
    description?: string;
    jobType: string;
    jobPayload: unknown;
    scheduleType: string;
    cronExpr?: string;
    intervalSeconds?: number;
    timezone?: string;
    isEnabled?: boolean;
    nextRunAt?: Date;
    createdBy?: string;
  }): Promise<ScheduledTaskRow> {
    const [row] = await this.db
      .insert(scheduledTasks)
      .values({
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        jobType: data.jobType,
        jobPayload: data.jobPayload,
        scheduleType: data.scheduleType,
        cronExpr: data.cronExpr ?? null,
        intervalSeconds: data.intervalSeconds ?? null,
        timezone: data.timezone ?? 'Asia/Shanghai',
        isEnabled: data.isEnabled ?? true,
        nextRunAt: data.nextRunAt ?? null,
        createdBy: data.createdBy ?? null,
      })
      .returning();
    return row as ScheduledTaskRow;
  }

  async updateTask(
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      jobType: string;
      jobPayload: unknown;
      scheduleType: string;
      cronExpr: string;
      intervalSeconds: number;
      timezone: string;
      isEnabled: boolean;
      nextRunAt: Date;
      lastRunAt: Date;
      lastRunStatus: string;
      lastError: string | null;
    }>
  ): Promise<ScheduledTaskRow | null> {
    const [row] = await this.db
      .update(scheduledTasks)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(scheduledTasks.id, id))
      .returning();
    return (row as ScheduledTaskRow) ?? null;
  }

  /** 直接设置下次到期时间（null=停止调度）。SchedulerService.reschedule/advanceSchedule 使用 */
  async setNextRunAt(id: string, next: Date | null): Promise<void> {
    await this.db
      .update(scheduledTasks)
      .set({ nextRunAt: next, updatedAt: new Date() })
      .where(eq(scheduledTasks.id, id));
  }

  async deleteTask(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(scheduledTasks)
      .where(eq(scheduledTasks.id, id))
      .returning();
    return !!row;
  }

  /** 调度器 tick：取所有到期且启用的任务 */
  async listDue(now: Date, limit = 50): Promise<ScheduledTaskRow[]> {
    return this.db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.isEnabled, true), lte(scheduledTasks.nextRunAt, now)))
      .orderBy(scheduledTasks.nextRunAt)
      .limit(limit);
  }

  /* ──── Runs ──── */

  async createRun(data: {
    id: string;
    taskId: string;
    status: string;
    triggerType: string;
    startedAt?: Date;
  }): Promise<ScheduledTaskRunRow> {
    const [row] = await this.db
      .insert(scheduledTaskRuns)
      .values({
        id: data.id,
        taskId: data.taskId,
        status: data.status,
        triggerType: data.triggerType,
        startedAt: data.startedAt ?? null,
      })
      .returning();
    return row as ScheduledTaskRunRow;
  }

  async updateRun(
    id: string,
    patch: Partial<{
      status: string;
      startedAt: Date;
      finishedAt: Date;
      durationMs: number;
      conclusion: string;
      outputPayload: unknown;
      errorMessage: string;
      metadata: unknown;
    }>
  ): Promise<ScheduledTaskRunRow | null> {
    const [row] = await this.db
      .update(scheduledTaskRuns)
      .set(patch)
      .where(eq(scheduledTaskRuns.id, id))
      .returning();
    return (row as ScheduledTaskRunRow) ?? null;
  }

  async getRun(id: string): Promise<ScheduledTaskRunRow | null> {
    const [row] = await this.db
      .select()
      .from(scheduledTaskRuns)
      .where(eq(scheduledTaskRuns.id, id))
      .limit(1);
    return (row as ScheduledTaskRunRow) ?? null;
  }

  async listRuns(taskId: string, limit = 50, offset = 0): Promise<ScheduledTaskRunRow[]> {
    return this.db
      .select()
      .from(scheduledTaskRuns)
      .where(eq(scheduledTaskRuns.taskId, taskId))
      .orderBy(desc(scheduledTaskRuns.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /** 列表页统计：某任务今日各状态执行数 */
  async countRunsByStatusSince(taskId: string, since: Date): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        status: scheduledTaskRuns.status,
        cnt: sql<number>`count(*)::int`,
      })
      .from(scheduledTaskRuns)
      .where(and(eq(scheduledTaskRuns.taskId, taskId), sql`${scheduledTaskRuns.createdAt} >= ${since}`))
      .groupBy(scheduledTaskRuns.status);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status] = Number(r.cnt);
    return out;
  }
}
