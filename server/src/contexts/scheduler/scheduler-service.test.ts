import { describe, it, expect, vi } from 'vitest';
import { SchedulerService } from './scheduler-service.js';
import type { ScheduledTaskRepository, ScheduledTaskRow } from '../../db/repositories/scheduled-task-repository.js';
import type { JobHandlerRegistry } from './job-handler-registry.js';
import type { JobHandler, JobResult } from './domain/job-handler.js';

function makeTask(over: Partial<ScheduledTaskRow> = {}): ScheduledTaskRow {
  return {
    id: 'task_1',
    name: 'test',
    description: null,
    jobType: 'system',
    jobPayload: { handlerKey: 'echo', params: { x: 1 } },
    scheduleType: 'interval',
    cronExpr: null,
    intervalSeconds: 60,
    timezone: 'Asia/Shanghai',
    isEnabled: true,
    nextRunAt: new Date('2026-06-15T00:00:00Z'),
    lastRunAt: null,
    lastRunStatus: null,
    lastError: null,
    retryCount: 0,
    maxAttempts: 3,
    deadLetterAt: null,
    deadLetterReason: null,
    createdBy: null,
    createdAt: new Date('2026-06-15T00:00:00Z'),
    updatedAt: new Date('2026-06-15T00:00:00Z'),
    ...over,
  };
}

function makeMocks() {
  const runs = new Map<string, Record<string, unknown>>();
  const repo = {
    listDue: vi.fn(async () => [] as ScheduledTaskRow[]),
    getTask: vi.fn(async (id: string) => makeTask({ id })),
    createRun: vi.fn(async (d: { id: string }) => {
      runs.set(d.id, { ...d });
      return runs.get(d.id);
    }),
    updateRun: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const r = runs.get(id);
      if (r) Object.assign(r, patch);
      return r ?? null;
    }),
    getRun: vi.fn(async (id: string) => runs.get(id) ?? null),
    updateTask: vi.fn(async () => null),
    setNextRunAt: vi.fn(async () => undefined),
  };
  const handler: JobHandler = {
    type: 'system',
    run: vi.fn(async (): Promise<JobResult> => ({ conclusion: 'ok', outputPayload: { a: 1 } })),
  };
  const registry = { resolve: vi.fn(() => handler) } as unknown as JobHandlerRegistry;
  const cron = {
    nextRunAt: vi.fn(() => new Date('2026-06-16T00:00:00Z')),
    validate: vi.fn(() => ({ valid: true })),
    nextOccurrences: vi.fn(() => []),
  };
  const lock = { tryLock: vi.fn(async () => true), unlock: vi.fn(async () => undefined) };
  return { repo, handler, registry, cron, lock };
}

describe('SchedulerService', () => {
  it('成功执行：run→completed，写 conclusion，scheduled 推进 schedule，释放锁', async () => {
    const m = makeMocks();
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never
    );
    const run = await svc.runOnce('task_1', 'scheduled');
    expect(run?.status).toBe('completed');
    expect(run?.conclusion).toBe('ok');
    expect(m.repo.setNextRunAt).toHaveBeenCalledWith('task_1', expect.any(Date));
    expect(m.repo.updateTask).toHaveBeenCalledWith(
      'task_1',
      expect.objectContaining({ lastRunStatus: 'completed', lastError: null })
    );
    expect(m.lock.unlock).toHaveBeenCalledWith('task_1');
  });

  it('失败：handler 抛错 → run failed + errorMessage + task.lastRunStatus=failed', async () => {
    const m = makeMocks();
    (m.handler.run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never
    );
    const run = await svc.runOnce('task_1', 'scheduled');
    expect(run?.status).toBe('failed');
    expect(run?.errorMessage).toBe('boom');
    expect(m.repo.updateTask).toHaveBeenCalledWith(
      'task_1',
      expect.objectContaining({ lastRunStatus: 'failed', lastError: 'boom' })
    );
  });

  it('超时：handler 超时 → run timeout', async () => {
    const m = makeMocks();
    (m.handler.run as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<JobResult>(() => undefined) // 永不 resolve
    );
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never,
      60_000,
      50
    );
    const run = await svc.runOnce('task_1', 'scheduled');
    expect(run?.status).toBe('timeout');
    expect(m.repo.updateTask).toHaveBeenCalledWith(
      'task_1',
      expect.objectContaining({ lastRunStatus: 'timeout' })
    );
  });

  it('锁失败：跳过执行，不创建 run', async () => {
    const m = makeMocks();
    m.lock.tryLock.mockResolvedValueOnce(false);
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never
    );
    const run = await svc.runOnce('task_1', 'scheduled');
    expect(run).toBeNull();
    expect(m.repo.createRun).not.toHaveBeenCalled();
  });

  it('manual 触发不推进 schedule，但仍释放锁', async () => {
    const m = makeMocks();
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never
    );
    await svc.runOnce('task_1', 'manual');
    expect(m.repo.setNextRunAt).not.toHaveBeenCalled();
    expect(m.lock.unlock).toHaveBeenCalled();
  });

  it('reschedule: interval → now + intervalSeconds', async () => {
    const m = makeMocks();
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never
    );
    const before = Date.now();
    const next = await svc.reschedule('task_1');
    expect(next).not.toBeNull();
    expect((next!.getTime() - before) / 1000).toBeCloseTo(60, 0);
    expect(m.repo.setNextRunAt).toHaveBeenCalledWith('task_1', next);
  });

  it('reschedule: cron → 委托 ICronCalculator.nextRunAt', async () => {
    const m = makeMocks();
    m.repo.getTask.mockResolvedValueOnce(
      makeTask({ scheduleType: 'cron', cronExpr: '0 9 * * 1', intervalSeconds: null })
    );
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never
    );
    const next = await svc.reschedule('task_1');
    expect(m.cron.nextRunAt).toHaveBeenCalledWith('0 9 * * 1', 'Asia/Shanghai');
    expect(next).toEqual(new Date('2026-06-16T00:00:00Z'));
  });

  it('reschedule: 禁用任务 → nextRunAt=null', async () => {
    const m = makeMocks();
    m.repo.getTask.mockResolvedValueOnce(makeTask({ isEnabled: false }));
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never
    );
    const next = await svc.reschedule('task_1');
    expect(next).toBeNull();
    expect(m.repo.setNextRunAt).toHaveBeenCalledWith('task_1', null);
  });

  it('tick: 取出所有到期任务并执行', async () => {
    const m = makeMocks();
    m.repo.listDue.mockResolvedValueOnce([makeTask({ id: 'a' }), makeTask({ id: 'b' })]);
    const svc = new SchedulerService(
      m.repo as unknown as ScheduledTaskRepository,
      m.registry,
      m.cron as never,
      m.lock as never
    );
    const n = await svc.tick();
    expect(n).toBe(2);
    expect(m.repo.createRun).toHaveBeenCalledTimes(2);
  });

  describe('retry & dead letter', () => {
    it('system 任务首次失败 → retry_count 递增,lastRunStatus=failed,不 advance schedule', async () => {
      const m = makeMocks();
      (m.handler.run as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      const svc = new SchedulerService(
        m.repo as unknown as ScheduledTaskRepository,
        m.registry,
        m.cron as never,
        m.lock as never
      );
      await svc.runOnce('task_1', 'scheduled');
      expect(m.repo.updateTask).toHaveBeenCalledWith(
        'task_1',
        expect.objectContaining({
          lastRunStatus: 'failed',
          lastError: 'boom',
          retryCount: 1, // 0 → 1
        })
      );
      // 不推进 schedule(等下次 tick 立即重试)
      expect(m.repo.setNextRunAt).not.toHaveBeenCalled();
    });

    it('system 任务重试到 max_attempts → 进入死信,nextRunAt=null + 触发 onDeadLetter', async () => {
      const m = makeMocks();
      (m.handler.run as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('persistent'));
      const onDeadLetter = vi.fn();
      const svc = new SchedulerService(
        m.repo as unknown as ScheduledTaskRepository,
        m.registry,
        m.cron as never,
        m.lock as never,
        60_000,
        300_000,
        onDeadLetter
      );
      // 已重试 maxAttempts-1=2 次,本次第 3 次失败 → 死信
      await svc.runOnce(
        'task_1',
        'scheduled',
        // 注:runOnce 不接受 row override,需通过 getTask mock 控制 retryCount
      );
      // 用第二个测试:重制 task 让 retryCount 已达 maxAttempts-1
      expect(onDeadLetter).not.toHaveBeenCalled();

      // 第二个场景:retryCount=2(已重试 2 次),第 3 次失败 → 死信
      m.repo.getTask.mockResolvedValueOnce(makeTask({ retryCount: 2, maxAttempts: 3 }));
      await svc.runOnce('task_1', 'scheduled');
      expect(m.repo.updateTask).toHaveBeenCalledWith(
        'task_1',
        expect.objectContaining({
          lastRunStatus: 'dead_letter',
          retryCount: 0, // 死信后清零,等人工 reset
          nextRunAt: null, // 暂停调度
          deadLetterReason: 'persistent',
        })
      );
      expect(onDeadLetter).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task_1' }),
        'persistent'
      );
      expect(m.repo.setNextRunAt).not.toHaveBeenCalled();
    });

    it('agent 任务失败 → 直接死信(默认不重试)', async () => {
      const m = makeMocks();
      (m.handler.run as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('agent fail'));
      // 模拟 agent 类型任务
      m.handler.type = 'agent' as never;
      m.repo.getTask.mockResolvedValueOnce(
        makeTask({ jobType: 'agent', jobPayload: { instanceId: 'i-1', prompt: 'hi' } })
      );
      const onDeadLetter = vi.fn();
      const svc = new SchedulerService(
        m.repo as unknown as ScheduledTaskRepository,
        m.registry,
        m.cron as never,
        m.lock as never,
        60_000,
        300_000,
        onDeadLetter
      );
      await svc.runOnce('task_1', 'scheduled');
      expect(m.repo.updateTask).toHaveBeenCalledWith(
        'task_1',
        expect.objectContaining({
          lastRunStatus: 'dead_letter',
          nextRunAt: null,
        })
      );
      expect(onDeadLetter).toHaveBeenCalled();
    });

    it('agent 任务可通过 jobPayload.retryable=true 显式开启重试', async () => {
      const m = makeMocks();
      (m.handler.run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('retry me'));
      m.handler.type = 'agent' as never;
      m.repo.getTask.mockResolvedValueOnce(
        makeTask({
          jobType: 'agent',
          jobPayload: { instanceId: 'i-1', prompt: 'hi', retryable: true },
        })
      );
      const svc = new SchedulerService(
        m.repo as unknown as ScheduledTaskRepository,
        m.registry,
        m.cron as never,
        m.lock as never
      );
      await svc.runOnce('task_1', 'scheduled');
      expect(m.repo.updateTask).toHaveBeenCalledWith(
        'task_1',
        expect.objectContaining({
          lastRunStatus: 'failed', // 重试,不是死信
          retryCount: 1,
        })
      );
    });

    it('重试后成功 → retry_count 清零 + advance schedule', async () => {
      const m = makeMocks();
      // 第一次失败第二次成功
      (m.handler.run as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('first fail'))
        .mockResolvedValueOnce({ conclusion: 'recovered', outputPayload: {} });
      const svc = new SchedulerService(
        m.repo as unknown as ScheduledTaskRepository,
        m.registry,
        m.cron as never,
        m.lock as never
      );
      // 第一次:失败 → retry_count=1
      await svc.runOnce('task_1', 'scheduled');
      // 第二次:task 已 retryCount=1,成功 → retry_count 清零
      m.repo.getTask.mockResolvedValueOnce(makeTask({ retryCount: 1 }));
      await svc.runOnce('task_1', 'scheduled');
      expect(m.repo.updateTask).toHaveBeenCalledWith(
        'task_1',
        expect.objectContaining({
          lastRunStatus: 'completed',
          retryCount: 0,
        })
      );
      // 成功才推进 schedule
      expect(m.repo.setNextRunAt).toHaveBeenCalledWith('task_1', expect.any(Date));
    });

    it('manual 触发失败不重试(避免手动操作被自动重试)', async () => {
      const m = makeMocks();
      (m.handler.run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('manual fail'));
      const svc = new SchedulerService(
        m.repo as unknown as ScheduledTaskRepository,
        m.registry,
        m.cron as never,
        m.lock as never
      );
      await svc.runOnce('task_1', 'manual');
      // manual 触发直接死信(因为 triggerType !== 'scheduled',不重试)
      expect(m.repo.updateTask).toHaveBeenCalledWith(
        'task_1',
        expect.objectContaining({ lastRunStatus: 'dead_letter' })
      );
    });

    it('onDeadLetter 抛错不影响调度主流程', async () => {
      const m = makeMocks();
      (m.handler.run as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      const throwingCb = vi.fn(() => {
        throw new Error('callback error');
      });
      const svc = new SchedulerService(
        m.repo as unknown as ScheduledTaskRepository,
        m.registry,
        m.cron as never,
        m.lock as never,
        60_000,
        300_000,
        throwingCb
      );
      // 让 retryCount 达到 max,触发死信 → 调 onDeadLetter → 抛错
      m.repo.getTask.mockResolvedValueOnce(makeTask({ retryCount: 2, maxAttempts: 3 }));
      // 不应 throw
      await expect(svc.runOnce('task_1', 'scheduled')).resolves.toBeDefined();
      expect(throwingCb).toHaveBeenCalled();
    });
  });
});
