import type { IInstanceProvisioner } from '../instance-service.js';
import type { Instance } from '../domain/instance.js';
import type { ContainerOrchestratorClient } from '../../gateway/clients/container-orchestrator-client.js';

export class ContainerOrchestratorProvisioner implements IInstanceProvisioner {
  constructor(private client: ContainerOrchestratorClient) {}

  async provision(instance: Instance): Promise<Record<string, unknown>> {
    if (!this.client.isConfigured()) {
      throw new Error('container-orchestrator gateway is not configured');
    }

    const result = await this.client.createInstance({
      appKey: instance.tenantId,
      userID: instance.employeeId ?? instance.id,
      name: instance.name,
    });

    return {
      engine: 'container-orchestrator',
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
