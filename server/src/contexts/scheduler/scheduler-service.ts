/**
 * SchedulerService —— 定时任务调度核心
 *
 * 设计：
 * - DB 驱动的统一 tick（复用 TraceSyncJob 的 setInterval 模式）：每次 tick 查
 *   is_enabled=true AND next_run_at<=now 的到期任务，逐个执行。
 * - 分布式安全：每次执行前 LockProvider.tryLock（PG advisory lock），多副本下只一个执行。
 * - 单进程 in-flight 互斥：Set<taskId> 防止长任务被下一 tick 重入。
 * - run 生命周期：running → completed | failed | timeout（仿 eval_runs 状态机）。
 * - 仅 scheduled 触发推进 nextRunAt；manual 触发不改变既有节奏。
 */

import type { ScheduledTaskRepository, ScheduledTaskRow, ScheduledTaskRunRow } from '../../db/repositories/scheduled-task-repository.js';
import type { JobHandlerRegistry } from './job-handler-registry.js';
import type { ICronCalculator } from './domain/cron.js';
import type { LockProvider } from './domain/lock.js';
import type { JobType, TriggerType } from './domain/job-handler.js';
import { newId } from '../../shared/utils.js';
import { logger } from '../../app/logger.js';

const DEFAULT_TIMEOUT_MS = 300_000; // 5 分钟

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class SchedulerService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private inflight = new Set<string>();

  constructor(
    private repo: ScheduledTaskRepository,
    private registry: JobHandlerRegistry,
    private cron: ICronCalculator,
    private lock: LockProvider,
    private intervalMs = 60_000,
    private timeoutMs = DEFAULT_TIMEOUT_MS
  ) {}

  start(): void {
    if (this.timer) return;
    logger.info({ intervalMs: this.intervalMs }, 'scheduler: started');
    // 启动即跑一次：补执行停机期间到期的任务
    this.tick().catch((err) => logger.error({ err }, 'scheduler: initial tick failed'));
    this.timer = setInterval(() => {
      this.tick().catch((err) => logger.error({ err }, 'scheduler: tick failed'));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('scheduler: stopped');
    }
  }

  /** tick：取出到期任务并执行，返回本轮执行数 */
  async tick(): Promise<number> {
    const now = new Date();
    const due = await this.repo.listDue(now);
    if (due.length === 0) return 0;
    logger.debug({ count: due.length }, 'scheduler: due tasks');
    let executed = 0;
    for (const task of due) {
      if (this.inflight.has(task.id)) continue; // 单进程 in-flight 互斥
      try {
        await this.executeTask(task, 'scheduled');
        executed++;
      } catch (err) {
        logger.warn({ taskId: task.id, err: String(err) }, 'scheduler: executeTask error');
      }
    }
    return executed;
  }

  /** 手动触发一次（triggerType=manual，不推进 schedule） */
  async runOnce(taskId: string, triggerType: TriggerType = 'manual'): Promise<ScheduledTaskRunRow | null> {
    const task = await this.repo.getTask(taskId);
    if (!task) return null;
    return this.executeTask(task, triggerType);
  }

  /** CRUD 后调用：根据当前调度配置重算 nextRunAt（null=停止调度） */
  async reschedule(taskId: string): Promise<Date | null> {
    const task = await this.repo.getTask(taskId);
    if (!task) return null;
    const next = this.computeNext(task);
    await this.repo.setNextRunAt(taskId, next);
    return next;
  }

  private async executeTask(
    task: ScheduledTaskRow,
    triggerType: TriggerType
  ): Promise<ScheduledTaskRunRow | null> {
    // 1. 分布式锁
    const locked = await this.lock.tryLock(task.id);
    if (!locked) {
      logger.debug({ taskId: task.id }, 'scheduler: locked by another replica, skip');
      return null;
    }
    this.inflight.add(task.id);

    const runId = newId('str');
    const startedAt = new Date();
    await this.repo.createRun({
      id: runId,
      taskId: task.id,
      status: 'running',
      triggerType,
      startedAt,
    });

    try {
      const handler = this.registry.resolve(task.jobType as JobType);
      const result = await this.withTimeout(
        handler.run({
          taskId: task.id,
          jobType: task.jobType as JobType,
          jobPayload: (task.jobPayload as Record<string, unknown>) ?? {},
          triggerType,
          runId,
        })
      );
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await this.repo.updateRun(runId, {
        status: 'completed',
        finishedAt,
        durationMs,
        conclusion: result.conclusion,
        outputPayload: result.outputPayload,
        metadata: result.metadata,
      });
      await this.repo.updateTask(task.id, {
        lastRunAt: finishedAt,
        lastRunStatus: 'completed',
        lastError: null,
      });
      logger.info({ taskId: task.id, runId, durationMs }, 'scheduler: task completed');
      return await this.repo.getRun(runId);
    } catch (err) {
      const status = err instanceof TimeoutError ? 'timeout' : 'failed';
      const message = err instanceof Error ? err.message : String(err);
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await this.repo.updateRun(runId, {
        status,
        finishedAt,
        durationMs,
        errorMessage: message,
      });
      await this.repo.updateTask(task.id, {
        lastRunAt: finishedAt,
        lastRunStatus: status,
        lastError: message,
      });
      logger.warn({ taskId: task.id, runId, status, message }, 'scheduler: task failed');
      return await this.repo.getRun(runId);
    } finally {
      this.inflight.delete(task.id);
      if (triggerType === 'scheduled') {
        await this.advanceSchedule(task).catch((err) =>
          logger.warn({ taskId: task.id, err: String(err) }, 'scheduler: advanceSchedule failed')
        );
      }
      await this.lock.unlock(task.id).catch((err) =>
        logger.warn({ taskId: task.id, err: String(err) }, 'scheduler: unlock failed')
      );
    }
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new TimeoutError(`task timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs
      );
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        }
      );
    });
  }

  private computeNext(task: ScheduledTaskRow): Date | null {
    if (!task.isEnabled) return null;
    if (task.scheduleType === 'interval' && task.intervalSeconds) {
      return new Date(Date.now() + task.intervalSeconds * 1000);
    }
    if (task.scheduleType === 'cron' && task.cronExpr) {
      return this.cron.nextRunAt(task.cronExpr, task.timezone);
    }
    return null;
  }

  private async advanceSchedule(task: ScheduledTaskRow): Promise<void> {
    const next = this.computeNext(task);
    await this.repo.setNextRunAt(task.id, next);
  }
}
