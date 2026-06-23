/**
 * instance-health-monitor —— 实例健康监控 + 自动 rebuild
 *
 * 数据源:ContainerOrchestratorClient.listInstances(FarmInstance.isActive/status)。
 * 判定:isActive=true && status='running' → healthy;否则 unhealthy;上游丢失 → missing。
 * 自愈:连续 failureThreshold 次(默认 3 次,即 5 分钟 ×3 = 15 分钟)unhealthy/missing → InstanceService.rebuild。
 * 防抖:同一实例 rebuildCooldownMs(默认 30 分钟)内最多 rebuild 1 次
 *   (通过 instance_health_snapshots.status='rebuild_triggered' 去重,多副本安全)。
 * 告警:rebuild 抛错 → notificationService.createAlert(severity='critical')。
 * 降级:Gateway 未配置或 listInstances 抛错 → 跳过本轮(不误杀)。
 */

import type { SystemJobFn, SystemJobHandler } from './system-handler.js';
import type { InstanceHealthRepository } from '../../../db/repositories/instance-health-repository.js';
import type { InstanceService } from '../../tenant-instance/instance-service.js';
import type { Instance, InstanceState } from '../../tenant-instance/domain/instance.js';
import { STATE } from '../../tenant-instance/domain/instance.js';
import type {
  ContainerOrchestratorClient,
  FarmInstance,
} from '../../gateway/clients/container-orchestrator-client.js';
import type { NotificationService } from '../../notification/notification-service.js';

const DEFAULT_FAILURE_THRESHOLD = 3; // 连续 3 次失败(15 分钟)触发 rebuild
const DEFAULT_REBUILD_COOLDOWN_MS = 30 * 60_000; // 30 分钟去重

const MONITORED_STATES: InstanceState[] = [STATE.RUNNING, STATE.PROVISIONING];

interface HealthMonitorParams {
  failureThreshold?: number;
  rebuildCooldownMs?: number;
}

interface RebuildContext {
  inst: Instance;
  healthRepo: InstanceHealthRepository;
  instanceService: InstanceService;
  notificationService: NotificationService;
  failureThreshold: number;
  rebuildCooldownMs: number;
  rebuilt: string[];
  rebuildFailed: { instanceId: string; error: string }[];
}

function isHealthy(inst: FarmInstance): boolean {
  return inst.isActive === true && (inst.status || '').toLowerCase() === 'running';
}

/** 与 ContainerOrchestratorProvisioner 同口径:employeeId 优先,id 兜底 */
function farmIdOf(inst: Instance): string {
  return inst.employeeId ?? inst.id;
}

export function registerInstanceHealthMonitor(
  handler: SystemJobHandler,
  instanceService: InstanceService,
  healthRepo: InstanceHealthRepository,
  orchestratorClient: ContainerOrchestratorClient,
  notificationService: NotificationService
): void {
  const fn: SystemJobFn = async (raw) => {
    const params = (raw ?? {}) as HealthMonitorParams;
    const failureThreshold = Number(params.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD);
    const rebuildCooldownMs = Number(params.rebuildCooldownMs ?? DEFAULT_REBUILD_COOLDOWN_MS);

    // 1. Gateway 未配置 → 降级跳过(不误判)
    if (!orchestratorClient.isConfigured()) {
      return {
        conclusion: 'container-orchestrator 未配置,跳过本轮健康监控',
        outputPayload: { skipped: true, reason: 'gateway_not_configured' },
        metadata: { skipped: true },
      };
    }

    // 2. 拉上游 FarmInstance 列表(批量,1 次请求)
    let farmMap: Map<string, FarmInstance>;
    try {
      const result = await orchestratorClient.listInstances();
      farmMap = new Map((result?.instances ?? []).map((f) => [f.userID, f]));
    } catch (e) {
      return {
        conclusion: `健康监控失败:无法读取 container-orchestrator 实例列表(${(e as Error).message})`,
        outputPayload: { error: (e as Error).message, failed: true },
        metadata: { failed: true },
      };
    }

    // 3. 本端 Instance,仅监控 RUNNING/PROVISIONING(其他状态不参与)
    const instances = (await instanceService.list()).filter((inst) =>
      MONITORED_STATES.includes(inst.state)
    );

    let healthy = 0;
    let unhealthy = 0;
    const rebuilt: string[] = [];
    const rebuildFailed: { instanceId: string; error: string }[] = [];

    for (const inst of instances) {
      const farmId = farmIdOf(inst);
      const farm = farmMap.get(farmId);
      const lastActivityAt = farm?.lastActive ? new Date(farm.lastActive) : null;

      // 4. 写探活快照(无论健康与否)
      if (!farm) {
        unhealthy++;
        await healthRepo.insertSnapshot({
          instanceId: inst.id,
          tenantId: inst.tenantId,
          status: 'missing',
          lastActivityAt,
        });
        await maybeRebuild({
          inst,
          healthRepo,
          instanceService,
          notificationService,
          failureThreshold,
          rebuildCooldownMs,
          rebuilt,
          rebuildFailed,
        });
        continue;
      }

      const ok = isHealthy(farm);
      if (ok) healthy++;
      else unhealthy++;

      await healthRepo.insertSnapshot({
        instanceId: inst.id,
        tenantId: inst.tenantId,
        status: ok ? 'healthy' : 'unhealthy',
        lastActivityAt,
      });

      if (!ok) {
        await maybeRebuild({
          inst,
          healthRepo,
          instanceService,
          notificationService,
          failureThreshold,
          rebuildCooldownMs,
          rebuilt,
          rebuildFailed,
        });
      }
    }

    const conclusion =
      `健康=${healthy} 异常=${unhealthy} 触发rebuild=${rebuilt.length} rebuild失败=${rebuildFailed.length}` +
      `(共 ${instances.length} 个 RUNNING/PROVISIONING 实例)`;

    return {
      conclusion,
      outputPayload: {
        total: instances.length,
        healthy,
        unhealthy,
        rebuilt,
        rebuildFailed,
      },
      metadata: {
        total: instances.length,
        healthy,
        unhealthy,
        rebuilt: rebuilt.length,
        rebuildFailed: rebuildFailed.length,
      },
    };
  };

  handler.register('instance-health-monitor', fn);
}

/**
 * 满足以下条件才 rebuild:
 * 1. 最近 failureThreshold 条快照全部非 healthy(连续失败)
 * 2. rebuildCooldownMs 内无 rebuild_triggered 记录(防抖)
 *
 * rebuild 失败 → 写 rebuild_failed + createAlert。
 */
async function maybeRebuild(ctx: RebuildContext): Promise<void> {
  const { inst, healthRepo } = ctx;

  // 1. 连续失败阈值判定
  const recent = await healthRepo.listRecent(inst.id, ctx.failureThreshold);
  if (recent.length < ctx.failureThreshold) return; // 累积期不足
  const allBad = recent.every((r) => r.status !== 'healthy');
  if (!allBad) return;

  // 2. cooldown 防抖
  const inCooldown = await healthRepo.hasRecentByStatus(
    inst.id,
    'rebuild_triggered',
    ctx.rebuildCooldownMs
  );
  if (inCooldown) return;

  // 3. 触发 rebuild
  try {
    await ctx.instanceService.rebuild(inst.id);
    await healthRepo.insertSnapshot({
      instanceId: inst.id,
      tenantId: inst.tenantId,
      status: 'rebuild_triggered',
    });
    ctx.rebuilt.push(inst.id);
  } catch (e) {
    const msg = (e as Error).message;
    await healthRepo.insertSnapshot({
      instanceId: inst.id,
      tenantId: inst.tenantId,
      status: 'rebuild_failed',
    });
    ctx.rebuildFailed.push({ instanceId: inst.id, error: msg });
    try {
      await ctx.notificationService.createAlert(inst.tenantId, {
        type: 'instance_health_rebuild_failed',
        severity: 'critical',
        title: `实例「${inst.name}」自愈失败`,
        message: `连续 ${ctx.failureThreshold} 次健康检查失败,rebuild 又失败:${msg}`,
        resourceType: 'instance',
        sourceId: inst.id,
        sourceName: inst.name,
      });
    } catch {
      /* 告警失败不影响主流程 */
    }
  }
}
