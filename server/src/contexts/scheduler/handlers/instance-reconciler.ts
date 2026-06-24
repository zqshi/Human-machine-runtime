/**
 * instance-reconciler —— 声明/运行调和 controller(v1.8 收官)
 *
 * 定时(每 5 分钟)遍历实例,按 desired→actual + specGeneration diff 调和(InstanceService.reconcile):
 * - 无 drift(decideReconcileAction==noop)直接跳过,不触发 reconcile 避免无谓 get/save
 * - 有 drift 调 reconcile:状态调和(stop/start)+ spec 增量;reconcile 失败累计达阈值时,
 *   InstanceService.reconcile 内部已 rebuild 兜底(整机重建),controller 仅统计成败
 *
 * 与 instance-health-monitor 分工:
 * - reconciler:主动调和"声明态(desired/spec)→运行态"(轻量 spec-diff,actual 跟随 desired)
 * - health-monitor:被动探活"运行态→远端真实态"(remote 不健康 → rebuild 兜底)
 * 两者每 5 分钟并行,互不阻塞;reconcile 兜底与 health-monitor rebuild 共用 InstanceService.rebuild。
 */

import type { SystemJobFn, SystemJobHandler } from './system-handler.js';
import type { InstanceService } from '../../tenant-instance/instance-service.js';
import { decideReconcileAction, type Instance } from '../../tenant-instance/domain/instance.js';

interface ReconcilerParams {
  /** reconcile 失败转 rebuild 的阈值(透传 InstanceService.reconcile,默认 3) */
  failureThreshold?: number;
  /** 限定租户(可选);缺省全租户 */
  tenantId?: string;
}

export function registerInstanceReconciler(
  handler: SystemJobHandler,
  instanceService: InstanceService
): void {
  const fn: SystemJobFn = async (raw) => {
    const params = (raw ?? {}) as ReconcilerParams;
    const failureThreshold = Number(params.failureThreshold ?? 3);

    const instances: Instance[] = await instanceService.list(params.tenantId);

    let noop = 0;
    let reconciled = 0;
    let failed = 0;
    const errors: { instanceId: string; error: string }[] = [];

    for (const inst of instances) {
      if (decideReconcileAction(inst) === 'noop') {
        noop++;
        continue;
      }
      try {
        await instanceService.reconcile(inst.id, { failureThreshold });
        reconciled++;
      } catch (e) {
        failed++;
        errors.push({ instanceId: inst.id, error: (e as Error).message });
      }
    }

    return {
      conclusion: `调和完成:无drift=${noop} 已调和=${reconciled} 失败=${failed}(共 ${instances.length} 个实例)`,
      outputPayload: { total: instances.length, noop, reconciled, failed, errors },
      metadata: { total: instances.length, noop, reconciled, failed },
    };
  };

  handler.register('instance-reconciler', fn);
}
