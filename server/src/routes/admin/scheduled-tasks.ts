import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { ScheduledTaskRepository } from '../../db/repositories/scheduled-task-repository.js';
import type { SchedulerService } from '../../contexts/scheduler/scheduler-service.js';
import type { ICronCalculator } from '../../contexts/scheduler/domain/cron.js';
import { describeCron } from '../../contexts/scheduler/domain/cron.js';
import type { Principal } from '../../middleware/auth.js';
import { newId } from '../../shared/utils.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const DEFAULT_TZ = 'Asia/Shanghai';

const createTaskSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  jobType: z.enum(['agent', 'system']),
  jobPayload: z.record(z.any()),
  scheduleType: z.enum(['cron', 'interval']),
  cronExpr: z.string().max(64).optional(),
  intervalSeconds: z.number().int().positive().max(86400 * 30).optional(),
  timezone: z.string().max(64).optional(),
  isEnabled: z.boolean().optional(),
});

const updateTaskSchema = createTaskSchema.partial();

const toggleSchema = z.object({ enabled: z.boolean() });
const validateCronSchema = z.object({ expr: z.string().min(1), tz: z.string().optional() });

function getCaller(c: Context): string {
  return (c.get('user') as Principal | undefined)?.username || 'system';
}

function resolveTz(tz?: string): string {
  return tz && tz.length > 0 ? tz : DEFAULT_TZ;
}

/** 校验调度配置一致性 + cron 合法性；返回错误信息或 null */
function validateScheduleConfig(
  cron: ICronCalculator,
  data: { scheduleType: string; cronExpr?: string; intervalSeconds?: number; timezone?: string }
): string | null {
  if (data.scheduleType === 'cron') {
    if (!data.cronExpr) return 'cron 模式需提供 cronExpr';
    const v = cron.validate(data.cronExpr, resolveTz(data.timezone));
    if (!v.valid) return `cron 表达式无效: ${v.error}`;
  } else if (data.scheduleType === 'interval') {
    if (!data.intervalSeconds) return 'interval 模式需提供 intervalSeconds';
  }
  return null;
}

export function createAdminScheduledTaskRoutes(
  repo: ScheduledTaskRepository,
  scheduler: SchedulerService,
  cron: ICronCalculator
) {
  const app = new Hono();

  /* ──── 列表 ──── */
  app.get('/', async (c) => {
    const isEnabledQ = c.req.query('isEnabled');
    const jobType = c.req.query('jobType');
    const filter: { isEnabled?: boolean; jobType?: string } = {};
    if (isEnabledQ === 'true') filter.isEnabled = true;
    if (isEnabledQ === 'false') filter.isEnabled = false;
    if (jobType) filter.jobType = jobType;
    const tasks = await repo.listTasks(filter);
    return c.json({ tasks });
  });

  /* ──── 创建 ──── */
  app.post('/', async (c) => {
    const parsed = await parseBody(c, createTaskSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);

    const data = parsed.data;
    const scheduleErr = validateScheduleConfig(cron, data);
    if (scheduleErr) return badRequest(c, scheduleErr);

    const id = newId('scht');
    await repo.createTask({
      id,
      name: data.name,
      description: data.description,
      jobType: data.jobType,
      jobPayload: data.jobPayload,
      scheduleType: data.scheduleType,
      cronExpr: data.cronExpr,
      intervalSeconds: data.intervalSeconds,
      timezone: data.timezone,
      isEnabled: data.isEnabled,
      createdBy: getCaller(c),
    });
    await scheduler.reschedule(id);
    return c.json(await repo.getTask(id), 201);
  });

  /* ──── 详情 ──── */
  app.get('/:id', async (c) => {
    const task = await repo.getTask(c.req.param('id'));
    if (!task) return c.json({ error: 'task not found' }, 404);
    return c.json(task);
  });

  /* ──── 更新 ──── */
  app.put('/:id', async (c) => {
    const parsed = await parseBody(c, updateTaskSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);

    const data = parsed.data;
    if (data.scheduleType) {
      const scheduleErr = validateScheduleConfig(cron, {
        scheduleType: data.scheduleType,
        cronExpr: data.cronExpr,
        intervalSeconds: data.intervalSeconds,
        timezone: data.timezone,
      });
      if (scheduleErr) return badRequest(c, scheduleErr);
    }

    const updated = await repo.updateTask(c.req.param('id'), {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.jobType !== undefined ? { jobType: data.jobType } : {}),
      ...(data.jobPayload !== undefined ? { jobPayload: data.jobPayload } : {}),
      ...(data.scheduleType !== undefined ? { scheduleType: data.scheduleType } : {}),
      ...(data.cronExpr !== undefined ? { cronExpr: data.cronExpr } : {}),
      ...(data.intervalSeconds !== undefined ? { intervalSeconds: data.intervalSeconds } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    });
    if (!updated) return c.json({ error: 'task not found' }, 404);
    await scheduler.reschedule(c.req.param('id'));
    return c.json(await repo.getTask(c.req.param('id')));
  });

  /* ──── 删除 ──── */
  app.delete('/:id', async (c) => {
    const ok = await repo.deleteTask(c.req.param('id'));
    if (!ok) return c.json({ error: 'task not found' }, 404);
    return c.json({ success: true });
  });

  /* ──── 启用/暂停 ──── */
  app.post('/:id/toggle', async (c) => {
    const parsed = await parseBody(c, toggleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);

    const id = c.req.param('id');
    const updated = await repo.updateTask(id, { isEnabled: parsed.data.enabled });
    if (!updated) return c.json({ error: 'task not found' }, 404);
    // 启用则重算下次；暂停则清空 nextRunAt 停止调度
    if (parsed.data.enabled) {
      await scheduler.reschedule(id);
    } else {
      await repo.setNextRunAt(id, null);
    }
    return c.json(await repo.getTask(id));
  });

  /* ──── 手动触发一次 ──── */
  app.post('/:id/run', async (c) => {
    const run = await scheduler.runOnce(c.req.param('id'), 'manual');
    if (!run) {
      return c.json({ error: 'task not found or locked by another execution' }, 409);
    }
    return c.json(run, 201);
  });

  /* ──── 执行历史 ──── */
  app.get('/:id/runs', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 200);
    const offset = parseInt(c.req.query('offset') ?? '0', 10) || 0;
    const runs = await repo.listRuns(c.req.param('id'), limit, offset);
    return c.json({ runs });
  });

  /* ──── 单次执行详情 ──── */
  app.get('/:id/runs/:runId', async (c) => {
    const run = await repo.getRun(c.req.param('runId'));
    if (!run || run.taskId !== c.req.param('id')) {
      return c.json({ error: 'run not found' }, 404);
    }
    return c.json(run);
  });

  /* ──── 校验 cron ──── */
  app.post('/validate-cron', async (c) => {
    const parsed = await parseBody(c, validateCronSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);

    const { expr, tz } = parsed.data;
    const tzResolved = resolveTz(tz);
    const v = cron.validate(expr, tzResolved);
    return c.json({
      valid: v.valid,
      error: v.error,
      description: describeCron(expr),
      next5:
        v.valid
          ? cron.nextOccurrences(expr, tzResolved, 5).map((d) => d.toISOString())
          : [],
    });
  });

  return app;
}
