/**
 * 离职员工监测与清理作业
 *
 * 数据源：ClawManagerClient.listInstances（上游成员状态，含 lastActive/isActive/status）。
 * 判定：
 * - inactive：lastActive 距今 > inactiveDays
 * - manager-flagged：上游 isActive=false 或 status 标记为离职/停用
 * 模式：
 * - detect-only：仅产出离职名单（推荐）
 * - detect-and-clean：按 scope 调 InstanceService.remove 清理实例（记忆/会话随实例级联或后续补）
 */

import type { ClawManagerClient, ClawManagerInstance } from '../../gateway/clients/claw-manager-client.js';
import type { InstanceService } from '../../tenant-instance/instance-service.js';
import type { SystemJobHandler } from './system-handler.js';

interface EmployeeCleanupParams {
  criteria?: 'inactive' | 'manager-flagged';
  inactiveDays?: number;
  mode?: 'detect-only' | 'detect-and-clean';
  scope?: string[];
}

interface ResignedMember {
  instanceId: string;
  name: string;
  lastActive: string | null;
  reason: string;
}

const INACTIVE_STATUS_HINTS = ['resigned', 'inactive', 'disabled', 'left', '离职'];

function isManagerFlagged(inst: ClawManagerInstance): boolean {
  if (inst.isActive === false) return true;
  const status = (inst.status || '').toLowerCase();
  return INACTIVE_STATUS_HINTS.some((h) => status.includes(h));
}

function isInactive(inst: ClawManagerInstance, days: number): { resigned: boolean; lastActiveMs: number } {
  if (!inst.lastActive) return { resigned: false, lastActiveMs: 0 };
  const lastMs = new Date(inst.lastActive).getTime();
  if (Number.isNaN(lastMs)) return { resigned: false, lastActiveMs: 0 };
  return { resigned: Date.now() - lastMs > days * 86400_000, lastActiveMs: lastMs };
}

/** 注册 employee-cleanup 作业 */
export function registerEmployeeCleanup(
  handler: SystemJobHandler,
  clawManager: ClawManagerClient,
  instanceSvc: InstanceService
): void {
  handler.register('employee-cleanup', async (raw) => {
    const params = (raw as EmployeeCleanupParams) ?? {};
    const criteria = params.criteria ?? 'inactive';
    const inactiveDays = Number(params.inactiveDays ?? 30);
    const mode = params.mode ?? 'detect-only';
    const scope = params.scope ?? ['instances'];

    // 拉取上游实例列表
    let instances: ClawManagerInstance[];
    try {
      const result = await clawManager.listInstances(1, 1000);
      instances = result?.items ?? [];
    } catch (e) {
      return {
        conclusion: `离职监测失败：无法读取 claw-manager 实例列表（${(e as Error).message}）`,
        outputPayload: { error: (e as Error).message },
        metadata: { criteria, mode, failed: true },
      };
    }

    // 判定离职
    const resigned: ResignedMember[] = [];
    for (const inst of instances) {
      let hit: boolean;
      let reason = '';
      if (criteria === 'manager-flagged') {
        hit = isManagerFlagged(inst);
        reason = '上游标记离职/停用';
      } else {
        const { resigned: r, lastActiveMs } = isInactive(inst, inactiveDays);
        hit = r;
        if (r) reason = `最后活跃 ${new Date(lastActiveMs).toISOString().slice(0, 10)}（>${inactiveDays}天）`;
      }
      if (hit) {
        resigned.push({
          instanceId: inst.appKey || inst.userId || inst.podName,
          name: inst.name,
          lastActive: inst.lastActive ?? null,
          reason,
        });
      }
    }

    // 清理（仅 detect-and-clean 模式）
    const cleaned: { instanceId: string; ok: boolean; error?: string }[] = [];
    if (mode === 'detect-and-clean' && scope.includes('instances')) {
      for (const m of resigned) {
        try {
          await instanceSvc.remove(m.instanceId);
          cleaned.push({ instanceId: m.instanceId, ok: true });
        } catch (e) {
          cleaned.push({ instanceId: m.instanceId, ok: false, error: (e as Error).message });
        }
      }
    }

    const conclusion = mode === 'detect-and-clean'
      ? `检测到 ${resigned.length} 名离职员工，已清理 ${cleaned.filter((c) => c.ok).length}/${resigned.length}（范围：${scope.join(',')}）`
      : `检测到 ${resigned.length} 名疑似离职员工（${criteria === 'inactive' ? `未活跃>${inactiveDays}天` : '上游标记'}），未执行清理（仅检测模式）`;

    return {
      conclusion,
      outputPayload: {
        criteria,
        inactiveDays,
        mode,
        scope,
        detected: resigned,
        cleaned: mode === 'detect-and-clean' ? cleaned : undefined,
        checkedInstances: instances.length,
      },
      metadata: { detected: resigned.length, cleaned: cleaned.length },
    };
  });
}
