import { type IInstanceProvisioner, type InstanceRemoteStatus } from '../instance-service.js';
import type { Instance } from '../domain/instance.js';
import { nowIso } from '../../../shared/utils.js';

export class LocalProvisioner implements IInstanceProvisioner {
  private running = new Map<string, { pid: number; startedAt: string }>();

  async provision(instance: Instance): Promise<Record<string, unknown>> {
    const startedAt = nowIso();
    const pid = Math.floor(Math.random() * 90000) + 10000;

    this.running.set(instance.id, { pid, startedAt });

    return {
      engine: 'local',
      pid,
      startedAt,
      endpoint: `http://localhost:0/agent/${instance.id}`,
    };
  }

  async teardown(instance: Instance): Promise<void> {
    this.running.delete(instance.id);
  }

  async reconcile(instance: Instance): Promise<Record<string, unknown>> {
    // 本地模拟:确认在跑并刷新 runtime。冷启动(实例未 provision)是 provision 的职责,非 reconcile
    // —— 故 Map 无记录时仅回写 reconciledAt,由上层判断是否需 provision/rebuild。
    const entry = this.running.get(instance.id);
    const reconciledAt = nowIso();
    if (!entry) {
      return { ...instance.runtime, reconciledAt };
    }
    return {
      engine: 'local',
      pid: entry.pid,
      startedAt: entry.startedAt,
      endpoint: `http://localhost:0/agent/${instance.id}`,
      reconciledAt,
    };
  }

  async getRemoteStatus(instance: Instance): Promise<InstanceRemoteStatus | null> {
    const entry = this.running.get(instance.id);
    if (!entry) return { state: 'stopped' };
    return { state: 'running', detail: { pid: entry.pid, startedAt: entry.startedAt } };
  }

  getRunning(): Map<string, { pid: number; startedAt: string }> {
    return new Map(this.running);
  }
}
