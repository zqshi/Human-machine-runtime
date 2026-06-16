import type { IInstanceProvisioner } from '../instance-service.js';
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

  getRunning(): Map<string, { pid: number; startedAt: string }> {
    return new Map(this.running);
  }
}
