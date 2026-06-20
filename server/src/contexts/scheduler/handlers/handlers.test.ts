import { describe, it, expect, vi } from 'vitest';
import { SystemJobHandler, registerTraceCleanup } from './system-handler.js';
import { registerWeeklyReport } from './weekly-report.js';
import { registerEmployeeCleanup } from './employee-cleanup.js';
import type { AiGatewayRepository } from '../../../db/repositories/ai-gateway-repository.js';
import type { AnalyticsService } from '../../analytics/analytics-service.js';
import type {
  ClusterInstanceClient,
  ClusterInstance,
} from '../../gateway/clients/cluster-instance-client.js';
import type { InstanceService } from '../../tenant-instance/instance-service.js';

function makeHandler() {
  return new SystemJobHandler();
}

describe('SystemJobHandler — echo', () => {
  it('echo 回显参数', async () => {
    const h = makeHandler();
    const r = await h.run({
      taskId: 't',
      jobType: 'system',
      jobPayload: { handlerKey: 'echo', params: { a: 1 } },
      triggerType: 'manual',
      runId: 'r',
    });
    expect(r.conclusion).toBe('echo: {"a":1}');
  });

  it('未知 handlerKey 返回提示，不抛错', async () => {
    const h = makeHandler();
    const r = await h.run({
      taskId: 't',
      jobType: 'system',
      jobPayload: { handlerKey: 'nope' },
      triggerType: 'manual',
      runId: 'r',
    });
    expect(r.conclusion).toContain('未知系统作业');
  });
});

describe('trace-cleanup', () => {
  it('调用 deleteTracesBefore 并返回删除数', async () => {
    const h = makeHandler();
    const repo = { deleteTracesBefore: vi.fn(async () => 42) } as unknown as AiGatewayRepository;
    registerTraceCleanup(h, repo);
    const r = await h.run({
      taskId: 't',
      jobType: 'system',
      jobPayload: { handlerKey: 'trace-cleanup', olderThanDays: 7 },
      triggerType: 'scheduled',
      runId: 'r',
    });
    expect(repo.deleteTracesBefore).toHaveBeenCalledWith(expect.any(Date));
    expect(r.conclusion).toContain('42');
    expect((r.outputPayload as { deleted: number }).deleted).toBe(42);
  });
});

describe('employee-cleanup', () => {
  function makeInst(over: Partial<ClusterInstance>): ClusterInstance {
    return {
      appKey: 'app1',
      userId: 'u1',
      employeeNumber: 1,
      name: '员工A',
      podName: 'pod',
      pvcName: '',
      svcName: '',
      status: 'running',
      managedBy: '',
      lastActive: '',
      createdAt: '',
      isActive: true,
      ...over,
    };
  }
  function makeCtx(params: Record<string, unknown>) {
    return {
      taskId: 't',
      jobType: 'system' as const,
      jobPayload: { handlerKey: 'employee-cleanup', ...params },
      triggerType: 'scheduled' as const,
      runId: 'r',
    };
  }

  it('inactive 模式：按未活跃天数判定', async () => {
    const h = makeHandler();
    const old = new Date(Date.now() - 40 * 86400_000).toISOString();
    const recent = new Date(Date.now() - 1 * 86400_000).toISOString();
    const claw = {
      listInstances: vi.fn(async () => ({
        items: [
          makeInst({ name: '老员工', lastActive: old }),
          makeInst({ name: '新员工', lastActive: recent }),
        ],
        total: 2,
        page: 1,
        pageSize: 1000,
      })),
    } as unknown as ClusterInstanceClient;
    const instSvc = { remove: vi.fn(async () => ({})) } as unknown as InstanceService;
    registerEmployeeCleanup(h, claw, instSvc);

    const r = await h.run(makeCtx({ criteria: 'inactive', inactiveDays: 30, mode: 'detect-only' }));
    const out = r.outputPayload as { detected: { name: string }[] };
    expect(out.detected).toHaveLength(1);
    expect(out.detected[0].name).toBe('老员工');
    expect(instSvc.remove).not.toHaveBeenCalled(); // 仅检测模式不清理
  });

  it('detect-and-clean：调用 InstanceService.remove', async () => {
    const h = makeHandler();
    const old = new Date(Date.now() - 40 * 86400_000).toISOString();
    const claw = {
      listInstances: vi.fn(async () => ({
        items: [makeInst({ name: '老员工', lastActive: old })],
        total: 1,
        page: 1,
        pageSize: 1000,
      })),
    } as unknown as ClusterInstanceClient;
    const instSvc = { remove: vi.fn(async () => ({ id: 'app1' })) } as unknown as InstanceService;
    registerEmployeeCleanup(h, claw, instSvc);

    const r = await h.run(
      makeCtx({
        criteria: 'inactive',
        inactiveDays: 30,
        mode: 'detect-and-clean',
        scope: ['instances'],
      })
    );
    expect(instSvc.remove).toHaveBeenCalledWith('app1');
    expect(r.conclusion).toContain('已清理 1/1');
  });

  it('manager-flagged 模式：读 isActive=false', async () => {
    const h = makeHandler();
    const claw = {
      listInstances: vi.fn(async () => ({
        items: [
          makeInst({ name: '已离职', isActive: false }),
          makeInst({ name: '在职', isActive: true }),
        ],
        total: 2,
        page: 1,
        pageSize: 1000,
      })),
    } as unknown as ClusterInstanceClient;
    const instSvc = { remove: vi.fn() } as unknown as InstanceService;
    registerEmployeeCleanup(h, claw, instSvc);

    const r = await h.run(makeCtx({ criteria: 'manager-flagged', mode: 'detect-only' }));
    const out = r.outputPayload as { detected: { name: string }[] };
    expect(out.detected).toHaveLength(1);
    expect(out.detected[0].name).toBe('已离职');
  });
});

describe('weekly-report', () => {
  function makeAnalytics() {
    return {
      getDauTrend: vi.fn(async () => ({ days: ['2026-06-10', '2026-06-11'], values: [100, 200] })),
      getMessagesTrend: vi.fn(async () => ({ days: ['2026-06-10'], values: [500] })),
      getTokensTrend: vi.fn(async () => ({ days: ['2026-06-10'], values: [10000] })),
      getRetentionTrend: vi.fn(async () => ({ days: ['2026-06-10'], values: [52] })),
    } as unknown as AnalyticsService;
  }

  it('默认模板：生成报告（无邮件发送，通知待接入）', async () => {
    const h = makeHandler();
    registerWeeklyReport(h, makeAnalytics());
    const r = await h.run({
      taskId: 't',
      jobType: 'system',
      jobPayload: { handlerKey: 'weekly-report', range: 'last-week' },
      triggerType: 'scheduled',
      runId: 'r',
    });
    expect(r.conclusion).toContain('通知渠道待统一接入');
    expect(r.conclusion).toContain('日均 DAU 150');
    expect((r.outputPayload as { markdown: string }).markdown).toContain('# Report Statistics');
    // 邮件字段已彻底移除
    expect((r.outputPayload as Record<string, unknown>).mailed).toBeUndefined();
    expect((r.metadata as Record<string, unknown>).mailed).toBeUndefined();
  });

  it('自定义模板：占位符替换', async () => {
    const h = makeHandler();
    registerWeeklyReport(h, makeAnalytics());
    const r = await h.run({
      taskId: 't',
      jobType: 'system',
      jobPayload: {
        handlerKey: 'weekly-report',
        range: 'last-week',
        templateMd: 'DAU={{avgDau}} Tokens={{totalTokens}}',
      },
      triggerType: 'scheduled',
      runId: 'r',
    });
    const md = (r.outputPayload as { markdown: string }).markdown;
    expect(md).toBe('DAU=150 Tokens=10000');
  });

  it('range=last-month：近30天窗口', async () => {
    const h = makeHandler();
    registerWeeklyReport(h, makeAnalytics());
    const r = await h.run({
      taskId: 't',
      jobType: 'system',
      jobPayload: { handlerKey: 'weekly-report', range: 'last-month' },
      triggerType: 'scheduled',
      runId: 'r',
    });
    expect((r.metadata as { avgDau: number }).avgDau).toBe(150);
  });
});
