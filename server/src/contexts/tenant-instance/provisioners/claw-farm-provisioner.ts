import type { IInstanceProvisioner } from '../instance-service.js';
import type { Instance } from '../domain/instance.js';
import type { ClawFarmClient } from '../../gateway/clients/claw-farm-client.js';

export class ClawFarmProvisioner implements IInstanceProvisioner {
  constructor(private client: ClawFarmClient) {}

  async provision(instance: Instance): Promise<Record<string, unknown>> {
    if (!this.client.isConfigured()) {
      throw new Error('claw-farm gateway is not configured');
    }

    const result = await this.client.createInstance({
      appKey: instance.tenantId,
      userID: instance.employeeId ?? instance.id,
      name: instance.name,
    });

    return {
      engine: 'claw-farm',
      podName: result.podName,
      empKey: result.empKey,
      status: result.status,
      lastActive: result.lastActive,
    };
  }

  async teardown(instance: Instance): Promise<void> {
    if (!this.client.isConfigured()) return;
    const instanceId = instance.employeeId ?? instance.id;
    await this.client.deleteInstance(instanceId);
  }

  async getRemoteStatus(instanceId: string): Promise<unknown> {
    if (!this.client.isConfigured()) return null;
    try {
      return await this.client.getInstanceStatus(instanceId);
    } catch {
      return null;
    }
  }
}
