/**
 * ensureBootstrapSchedulerTasks —— 启动时幂等 seed 关键调度任务
 *
 * 设计:
 * - 仅在任务不存在时创建(若已存在则尊重运维手动调整,不动)。
 * - 由 bootstrap 在 schedulerService.start 之前 fire-and-forget 调用。
 * - 失败仅日志告警,不阻塞 app 启动(scheduler 自身仍可正常运行已存在的任务)。
 */

import type { ScheduledTaskRepository } from '../../db/repositories/scheduled-task-repository.js';
import { logger } from '../../app/logger.js';

export interface EnsureTaskInput {
  id: string;
  name: string;
  description?: string;
  jobType: 'system' | 'agent';
  jobPayload: unknown;
  scheduleType: 'cron' | 'interval';
  cronExpr?: string;
  intervalSeconds?: number;
  timezone?: string;
}

export async function ensureSchedulerTasks(
  repo: ScheduledTaskRepository,
  tasks: EnsureTaskInput[]
): Promise<void> {
  for (const t of tasks) {
    try {
      const existing = await repo.getTask(t.id);
      if (existing) continue;
      await repo.createTask({
        id: t.id,
        name: t.name,
        description: t.description,
        jobType: t.jobType,
        jobPayload: t.jobPayload,
        scheduleType: t.scheduleType,
        cronExpr: t.cronExpr,
        intervalSeconds: t.intervalSeconds,
        timezone: t.timezone ?? 'Asia/Shanghai',
        isEnabled: true,
        // nextRunAt 由 SchedulerService.reschedule 在首次 tick 时计算
      });
      logger.info({ taskId: t.id }, 'bootstrap: scheduler task seeded');
    } catch (err) {
      logger.warn(
        { taskId: t.id, err: String(err) },
        'bootstrap: ensureSchedulerTasks failed for task'
      );
    }
  }
}

/** 内置关键任务清单(启动时自动 ensure) */
export const BOOTSTRAP_SCHEDULER_TASKS: EnsureTaskInput[] = [
  {
    id: 'scht_instance_health_monitor',
    name: '实例健康监控',
    description:
      '每 5 分钟探活 RUNNING/PROVISIONING 实例,连续 3 次失败自动 rebuild(30 分钟防抖)。' +
      'handlerKey=instance-health-monitor',
    jobType: 'system',
    jobPayload: { handlerKey: 'instance-health-monitor' },
    scheduleType: 'cron',
    cronExpr: '*/5 * * * *',
    timezone: 'Asia/Shanghai',
  },
];
