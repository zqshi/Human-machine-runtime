/**
 * ToolDefinitionService — Definition CRUD + 启停。
 *
 * 从 ToolManagementService 拆出(委托模式,T45)。public 接口不变,
 * ToolManagementService 委托本 service。
 */
import type {
  ToolDefinitionRepository,
  ToolDefinitionRow,
} from '../../../db/repositories/tool-registry-repository.js';

export class ToolDefinitionService {
  constructor(private definitionRepo: ToolDefinitionRepository) {}

  async listDefinitions(tenantId: string, sourceId?: string): Promise<ToolDefinitionRow[]> {
    if (sourceId) return this.definitionRepo.findBySource(sourceId);
    return this.definitionRepo.findByTenant(tenantId);
  }

  async getDefinition(id: string): Promise<ToolDefinitionRow | null> {
    return this.definitionRepo.findById(id);
  }

  async updateDefinition(
    id: string,
    data: Record<string, unknown>
  ): Promise<ToolDefinitionRow | null> {
    return this.definitionRepo.update(id, data as Parameters<typeof this.definitionRepo.update>[1]);
  }

  async toggleDefinition(id: string, enabled: boolean): Promise<void> {
    await this.definitionRepo.update(id, { enabled });
  }
}
