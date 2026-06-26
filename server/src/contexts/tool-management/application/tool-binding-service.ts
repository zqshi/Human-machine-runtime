/**
 * ToolBindingService — Instance 绑定(分配工具给 Agent instance)。
 *
 * 从 ToolManagementService 拆出(委托模式,T45)。public 接口不变,
 * ToolManagementService 委托本 service。
 */
import { newId } from '../../../shared/utils.js';
import type { ToolInstanceRepository } from '../../../db/repositories/tool-registry-repository.js';

export class ToolBindingService {
  constructor(private instanceRepo: ToolInstanceRepository) {}

  async listInstances(tenantId: string): Promise<unknown[]> {
    return this.instanceRepo.findByTenant(tenantId);
  }

  async bindTool(
    definitionId: string,
    tenantId: string,
    instanceId?: string,
    displayName?: string
  ): Promise<unknown> {
    return this.instanceRepo.create({
      id: newId('tinst'),
      definitionId,
      tenantId,
      instanceId: instanceId ?? null,
      displayName: displayName ?? null,
      status: 'active',
    });
  }

  async unbindTool(id: string): Promise<void> {
    await this.instanceRepo.delete(id);
  }
}
