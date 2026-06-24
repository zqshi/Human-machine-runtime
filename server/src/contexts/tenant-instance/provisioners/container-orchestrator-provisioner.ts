import { type IInstanceProvisioner, type InstanceRemoteStatus } from '../instance-service.js';
import type { Instance } from '../domain/instance.js';
import type { ContainerOrchestratorClient } from '../../gateway/clients/container-orchestrator-client.js';
import { nowIso } from '../../../shared/utils.js';

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

  async reconcile(instance: Instance): Promise<Record<string, unknown>> {
    if (!this.client.isConfigured()) {
      throw new Error('container-orchestrator gateway is not configured');
    }
    const instanceId = instance.employeeId ?? instance.id;
    // 尽力状态级调和:查远端真实态,若未在跑则 start。spec 级变更(扩容)上游 API 不支持,
    // 由 InstanceService.reconcile 决策降级为 rebuild——此方法不处理 spec 变更。
    const remote = await this.client.getInstanceStatus(instanceId);
    if (!remote.isActive) {
      await this.client.startInstance(instanceId);
    }
    return { ...instance.runtime, reconciledAt: nowIso() };
  }

  async getRemoteStatus(instance: Instance): Promise<InstanceRemoteStatus | null> {
    if (!this.client.isConfigured()) return null;
    const instanceId = instance.employeeId ?? instance.id;
    try {
      const remote = await this.client.getInstanceStatus(instanceId);
      return {
        state: remote.isActive ? 'running' : 'stopped',
        detail: { podName: remote.podName, status: remote.status, lastActive: remote.lastActive },
      };
    } catch {
      // 查询容错:失败不抛,标记 unknown 供上层判断
      return { state: 'unknown' };
    }
  }
}
