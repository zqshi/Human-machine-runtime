/**
 * ToolManagementService — 工具管理核心编排服务(委托层,T45 重构后)。
 *
 * 原 639 行单文件按委托模式拆为 4 子 service + 1 共享 helper(见 application/):
 * - ToolSourceService:Source CRUD + Sync + Introspect + testConnection + uploadSpec
 * - ToolDefinitionService:Definition CRUD + 启停
 * - ToolBindingService:Instance 绑定
 * - ToolExecutionService:executeTool + 调用日志
 * - credential-resolver:凭证解密共享 helper(Source/Execution 共用)
 *
 * 本类保留全部 public 方法签名(保护 17 测试 + ToolRegistryService 下游委托),
 * 内部委托子 service。getStats/getCallLogs 跨 repo 聚合查询留本类(编排层职责)。
 *
 * 构造签名不变(5 个 repo/provider),tool-bundle.ts 组装处零改动;内部自组装子 service。
 */

import type {
  ToolSourceRepository,
  ToolDefinitionRepository,
  ToolInstanceRepository,
  ToolCallLogRepository,
  ToolSourceRow,
  ToolDefinitionRow,
} from '../../db/repositories/tool-registry-repository.js';
import type {
  CreateSourceInput,
  SyncResult,
  ExecutionContext,
  CredentialSecretProvider,
  TestConnectionResult,
  ToolStats,
} from './types.js';
import type { IntrospectResult } from './parsers/db-introspector.js';
import type { ToolInvocationResult } from './tool-registry.js';
import { ToolSourceService } from './application/tool-source-service.js';
import { ToolDefinitionService } from './application/tool-definition-service.js';
import { ToolBindingService } from './application/tool-binding-service.js';
import { ToolExecutionService } from './application/tool-execution-service.js';

export class ToolManagementService {
  private sourceService: ToolSourceService;
  private definitionService: ToolDefinitionService;
  private bindingService: ToolBindingService;
  private executionService: ToolExecutionService;

  constructor(
    private sourceRepo: ToolSourceRepository,
    private definitionRepo: ToolDefinitionRepository,
    instanceRepo: ToolInstanceRepository,
    private callLogRepo: ToolCallLogRepository,
    credentialSecretProvider: CredentialSecretProvider
  ) {
    this.sourceService = new ToolSourceService(
      sourceRepo,
      definitionRepo,
      credentialSecretProvider
    );
    this.definitionService = new ToolDefinitionService(definitionRepo);
    this.bindingService = new ToolBindingService(instanceRepo);
    this.executionService = new ToolExecutionService(
      definitionRepo,
      sourceRepo,
      callLogRepo,
      credentialSecretProvider
    );
  }

  /* ──── Source(委托 ToolSourceService)──── */

  async listSources(tenantId: string): Promise<ToolSourceRow[]> {
    return this.sourceService.listSources(tenantId);
  }

  async getSource(id: string): Promise<ToolSourceRow | null> {
    return this.sourceService.getSource(id);
  }

  async createSource(
    tenantId: string,
    input: CreateSourceInput,
    createdBy?: string
  ): Promise<ToolSourceRow> {
    return this.sourceService.createSource(tenantId, input, createdBy);
  }

  async updateSource(id: string, data: Record<string, unknown>): Promise<ToolSourceRow | null> {
    return this.sourceService.updateSource(id, data);
  }

  async deleteSource(id: string): Promise<void> {
    return this.sourceService.deleteSource(id);
  }

  async syncSource(sourceId: string): Promise<SyncResult> {
    return this.sourceService.syncSource(sourceId);
  }

  async introspectSource(sourceId: string): Promise<IntrospectResult> {
    return this.sourceService.introspectSource(sourceId);
  }

  async testConnection(sourceId: string): Promise<TestConnectionResult> {
    return this.sourceService.testConnection(sourceId);
  }

  async uploadSpec(
    specContent: string
  ): Promise<{ specVersion: string; title: string; toolCount: number }> {
    return this.sourceService.uploadSpec(specContent);
  }

  /* ──── Definition(委托 ToolDefinitionService)──── */

  async listDefinitions(tenantId: string, sourceId?: string): Promise<ToolDefinitionRow[]> {
    return this.definitionService.listDefinitions(tenantId, sourceId);
  }

  async getDefinition(id: string): Promise<ToolDefinitionRow | null> {
    return this.definitionService.getDefinition(id);
  }

  async updateDefinition(
    id: string,
    data: Record<string, unknown>
  ): Promise<ToolDefinitionRow | null> {
    return this.definitionService.updateDefinition(id, data);
  }

  async toggleDefinition(id: string, enabled: boolean): Promise<void> {
    return this.definitionService.toggleDefinition(id, enabled);
  }

  /* ──── Instance Binding(委托 ToolBindingService)──── */

  async listInstances(tenantId: string): Promise<unknown[]> {
    return this.bindingService.listInstances(tenantId);
  }

  async bindTool(
    definitionId: string,
    tenantId: string,
    instanceId?: string,
    displayName?: string
  ): Promise<unknown> {
    return this.bindingService.bindTool(definitionId, tenantId, instanceId, displayName);
  }

  async unbindTool(id: string): Promise<void> {
    return this.bindingService.unbindTool(id);
  }

  /* ──── Execution(委托 ToolExecutionService)──── */

  async executeTool(
    definitionId: string,
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolInvocationResult> {
    return this.executionService.executeTool(definitionId, params, context);
  }

  /* ──── Stats(跨 repo 聚合查询,留编排层)──── */

  async getStats(tenantId: string): Promise<ToolStats> {
    const sources = await this.sourceRepo.findAll(tenantId);
    const definitions = await this.definitionRepo.findByTenant(tenantId);
    const callStats = await this.callLogRepo.getStats(tenantId);

    return {
      totalSources: sources.length,
      totalDefinitions: definitions.length,
      enabledDefinitions: definitions.filter((d) => d.enabled).length,
      totalCalls: callStats.totalCalls,
      successRate:
        callStats.totalCalls > 0
          ? Math.round((callStats.successCalls / callStats.totalCalls) * 100)
          : 0,
      avgDurationMs: callStats.avgDurationMs,
    };
  }

  async getCallLogs(tenantId: string, opts?: { limit?: number; offset?: number }) {
    return this.callLogRepo.findByTenant(tenantId, opts);
  }
}
