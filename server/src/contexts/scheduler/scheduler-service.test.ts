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
});
