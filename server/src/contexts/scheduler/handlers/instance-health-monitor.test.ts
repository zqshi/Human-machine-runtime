import { describe, it, expect, vi } from 'vitest';
import { SystemJobHandler } from './system-handler.js';
import { registerInstanceHealthMonitor } from './instance-health-monitor.js';
import type { InstanceHealthRepository } from '../../../db/repositories/instance-health-repository.js';
import type { InstanceService } from '../../tenant-instance/instance-service.js';
import type { Instance, InstanceState } from '../../tenant-instance/domain/instance.js';
import { STATE } from '../../tenant-instance/domain/instance.js';
import type {
  ContainerOrchestratorClient,
  FarmInstance,
} from '../../gateway/clients/container-orchestrator-client.js';
import type { NotificationService } from '../../notification/notification-service.js';

function makeInstance(over: Partial<Instance> = {}): Instance {
  return {
    id: 'inst_1',
    tenantId: 'tnt_1',
    name: '员工1',
    source: 'api',
    matrixRoomId: null,
    creator: 'system',
    enterpriseUserId: null,
    employeeNo: 'DE001',
    employeeId: 'farm-user-1',
    email: null,
    jobCode: '',
    jobTitle: '',
    department: 'general',
    departmentId: null,
    permissionTemplateId: '',
    permissionTemplate: null,
    state: STATE.RUNNING,
    runtime: {},
    resources: {
      compute: { cpu: '500m', memory: '512Mi', gpu: null },
      model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
      budget: { monthlyLimitCny: 0, dailyLimitCny: null, alertThresholdPct: 80 },
      storage: { persistentVolumeSize: '2Gi', tempStorageSize: '1Gi' },
      source: 'tenant_default',
      customizedAt: null,
      customizedBy: null,
    },
    policy: {},
    approvalPolicy: {},
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    lastError: null,
    version: 1,
    ...over,
  };
}

function makeFarm(over: Partial<FarmInstance> = {}): FarmInstance {
  return {
    appKey: 'tnt_1',
    userID: 'farm-user-1',
    empKey: '',
    podName: 'pod-1',
    status: 'running',
    lastActive: new Date().toISOString(),
    employeeNumber: 1,
    name: '员工1',
    isActive: true,
    ...over,
  };
}

function makeMocks() {
  const snapshots = new Map<string, { status: string; checkedAt: Date }[]>();
  const healthRepo = {
    insertSnapshot: vi.fn(async (data: { instanceId: string; status: string }) => {
      const list = snapshots.get(data.instanceId) ?? [];
      list.unshift({ status: data.status, checkedAt: new Date() });
      snapshots.set(data.instanceId, list);
    }),
    listRecent: vi.fn(async (id: string, limit: number) => {
      const list = snapshots.get(id) ?? [];
      return list.slice(0, limit).map((s) => ({
        id: 0,
        instanceId: id,
        tenantId: 'tnt_1',
        status: s.status,
        cpuUsage: null,
        memoryUsage: null,
        uptimeSeconds: null,
        lastActivityAt: null,
        checkedAt: s.checkedAt,
      }));
    }),
    hasRecentByStatus: vi.fn(async () => false),
  };
  const instanceService = {
    list: vi.fn(async () => [makeInstance()]),
    rebuild: vi.fn(async (id: string) => makeInstance({ id })),
  };
  const orchestrator = {
    isConfigured: vi.fn(() => true),
    listInstances: vi.fn(async () => ({ instances: [makeFarm()] })),
  };
  const notificationService = {
    createAlert: vi.fn(async () => 'ntf_1'),
  };
  /** 直接塞入快照历史(模拟之前几轮的失败累积) */
  function seedSnapshots(instanceId: string, statuses: string[]): void {
    snapshots.set(
      instanceId,
      statuses.map((status) => ({ status, checkedAt: new Date() }))
    );
  }
  return { healthRepo, instanceService, orchestrator, notificationService, seedSnapshots };
}

function runMonitor(handler: SystemJobHandler, params: Record<string, unknown> = {}) {
  return handler.run({
    taskId: 't',
    jobType: 'system',
    jobPayload: { handlerKey: 'instance-health-monitor', ...params },
    triggerType: 'scheduled',
    runId: 'r',
  });
}

describe('instance-health-monitor', () => {
  it('Gateway 未配置 → 跳过本轮,不查上游', async () => {
    const m = makeMocks();
    m.orchestrator.isConfigured.mockReturnValue(false);
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    const r = await runMonitor(h);
    expect(r.conclusion).toContain('跳过');
    expect(m.orchestrator.listInstances).not.toHaveBeenCalled();
    expect(m.healthRepo.insertSnapshot).not.toHaveBeenCalled();
  });

  it('listInstances 抛错 → 返回 failed,不写快照不 rebuild', async () => {
    const m = makeMocks();
    m.orchestrator.listInstances.mockRejectedValueOnce(new Error('gateway down'));
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    const r = await runMonitor(h);
    expect((r.metadata as { failed: boolean }).failed).toBe(true);
    expect(m.healthRepo.insertSnapshot).not.toHaveBeenCalled();
    expect(m.instanceService.rebuild).not.toHaveBeenCalled();
  });

  it('全部 healthy → 写 healthy 快照,不 rebuild', async () => {
    const m = makeMocks();
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    const r = await runMonitor(h);
    expect(m.healthRepo.insertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'healthy', instanceId: 'inst_1' })
    );
    expect(m.instanceService.rebuild).not.toHaveBeenCalled();
    expect((r.metadata as { healthy: number }).healthy).toBe(1);
    expect((r.metadata as { unhealthy: number }).unhealthy).toBe(0);
  });

  it('unhealthy 但累积期不足 → 不 rebuild', async () => {
    const m = makeMocks();
    m.orchestrator.listInstances.mockResolvedValueOnce({
      instances: [makeFarm({ isActive: false, status: 'crashed' })],
    });
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    await runMonitor(h);
    expect(m.healthRepo.insertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unhealthy' })
    );
    expect(m.instanceService.rebuild).not.toHaveBeenCalled();
  });

  it('连续 failureThreshold 次 unhealthy → 触发 rebuild + 写 rebuild_triggered', async () => {
    const m = makeMocks();
    m.orchestrator.listInstances.mockResolvedValueOnce({
      instances: [makeFarm({ isActive: false, status: 'crashed' })],
    });
    // 预置 2 条历史 unhealthy 快照,加上本次 1 条,凑齐 3
    m.seedSnapshots('inst_1', ['unhealthy', 'unhealthy']);
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    const r = await runMonitor(h);
    expect(m.instanceService.rebuild).toHaveBeenCalledWith('inst_1');
    expect(m.healthRepo.insertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rebuild_triggered' })
    );
    expect((r.metadata as { rebuilt: number }).rebuilt).toBe(1);
  });

  it('在 rebuild cooldown 内 → 不重复 rebuild', async () => {
    const m = makeMocks();
    m.orchestrator.listInstances.mockResolvedValueOnce({
      instances: [makeFarm({ isActive: false, status: 'crashed' })],
    });
    m.seedSnapshots('inst_1', ['unhealthy', 'unhealthy']);
    m.healthRepo.hasRecentByStatus.mockResolvedValueOnce(true); // cooldown 内
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    const r = await runMonitor(h);
    expect(m.instanceService.rebuild).not.toHaveBeenCalled();
    expect((r.metadata as { rebuilt: number }).rebuilt).toBe(0);
  });

  it('rebuild 抛错 → 写 rebuild_failed + createAlert', async () => {
    const m = makeMocks();
    m.orchestrator.listInstances.mockResolvedValueOnce({
      instances: [makeFarm({ isActive: false, status: 'crashed' })],
    });
    m.seedSnapshots('inst_1', ['unhealthy', 'unhealthy']);
    m.instanceService.rebuild.mockRejectedValueOnce(new Error('rebuild boom'));
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    const r = await runMonitor(h);
    expect(m.healthRepo.insertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rebuild_failed' })
    );
    expect(m.notificationService.createAlert).toHaveBeenCalledWith(
      'tnt_1',
      expect.objectContaining({
        type: 'instance_health_rebuild_failed',
        severity: 'critical',
        sourceId: 'inst_1',
      })
    );
    expect((r.metadata as { rebuildFailed: number }).rebuildFailed).toBe(1);
  });

  it('上游丢失 → status=missing,走 rebuild 分支', async () => {
    const m = makeMocks();
    m.orchestrator.listInstances.mockResolvedValueOnce({ instances: [] });
    m.seedSnapshots('inst_1', ['missing', 'missing']);
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    const r = await runMonitor(h);
    expect(m.healthRepo.insertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'missing' })
    );
    expect(m.instanceService.rebuild).toHaveBeenCalledWith('inst_1');
    expect((r.metadata as { unhealthy: number }).unhealthy).toBe(1);
  });

  it('仅 RUNNING/PROVISIONING 参与,STOPPED/FAILED 不监控', async () => {
    const m = makeMocks();
    m.instanceService.list.mockResolvedValueOnce([
      makeInstance({ id: 'a', state: STATE.RUNNING }),
      makeInstance({ id: 'b', state: STATE.STOPPED }),
      makeInstance({ id: 'c', state: STATE.FAILED }),
      makeInstance({ id: 'd', state: STATE.PROVISIONING, employeeId: 'farm-d' }),
    ]);
    m.orchestrator.listInstances.mockResolvedValueOnce({
      instances: [
        makeFarm({ userID: 'farm-user-1', isActive: true }),
        makeFarm({ userID: 'farm-d', isActive: true }),
      ],
    });
    const h = new SystemJobHandler();
    registerInstanceHealthMonitor(
      h,
      m.instanceService as unknown as InstanceService,
      m.healthRepo as unknown as InstanceHealthRepository,
      m.orchestrator as unknown as ContainerOrchestratorClient,
      m.notificationService as unknown as NotificationService
    );
    const r = await runMonitor(h);
    // 只写 2 条快照(RUNNING + PROVISIONING),STOPPED/FAILED 跳过
    expect(m.healthRepo.insertSnapshot).toHaveBeenCalledTimes(2);
    expect((r.metadata as { total: number }).total).toBe(2);
  });
});
