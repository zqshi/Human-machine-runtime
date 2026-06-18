/**
 * ToolRegistryService — IToolRegistry 的 application 层实现
 *
 * 参考微服务服务注册/发现：在 ToolManagementService（源/定义/执行）之上封装统一的
 * 注册、发现、健康、调用端口。消费方（管理页路由、Agent 运行时）只依赖 IToolRegistry。
 *
 * 设计：委托 ToolManagementService 复用其 createSource/sync/listDefinitions/executeTool，
 * 避免重复实现；invoke 在 executeTool 之上补齐租户隔离校验并返回 logId。
 */
import { matchDiscoveryQuery } from './tool-registry.js';
import type {
  IToolRegistry,
  ToolEndpoint,
  ToolSourceDescriptor,
  ToolHealthRecord,
  ToolHealthStatus,
  ToolInvocationRequest,
  ToolInvocationResult,
  ToolDiscoveryQuery,
} from './tool-registry.js';
import type { ToolManagementService } from './tool-management-service.js';
import type {
  ToolSourceRepository,
  ToolSourceRow,
  ToolDefinitionRow,
} from '../../db/repositories/tool-registry-repository.js';
import type { CreateSourceInput, ExecutionType } from './types.js';

function toEndpoint(def: ToolDefinitionRow): ToolEndpoint {
  return {
    definitionId: def.id,
    sourceId: def.sourceId,
    tenantId: def.tenantId,
    name: def.name,
    description: def.description ?? null,
    executionType: def.executionType as ExecutionType,
    inputSchema: (def.inputSchema as Record<string, unknown> | null) ?? null,
    tags: def.tags ?? [],
    enabled: def.enabled,
  };
}

function toDescriptor(src: ToolSourceRow): ToolSourceDescriptor {
  return {
    id: src.id,
    tenantId: src.tenantId,
    sourceType: src.sourceType as ToolSourceDescriptor['sourceType'],
    name: src.name,
    status: src.status as ToolSourceDescriptor['status'],
    toolCount: src.toolCount,
    // P4 接 healthStatus 字段后改为真实状态；当前未探活故 unknown。
    health: 'unknown',
  };
}

export class ToolRegistryService implements IToolRegistry {
  constructor(
    private mgmt: ToolManagementService,
    private sourceRepo: ToolSourceRepository
  ) {}

  async registerSource(
    input: CreateSourceInput,
    tenantId: string,
    createdBy?: string
  ): Promise<ToolSourceDescriptor> {
    const row = await this.mgmt.createSource(tenantId, input, createdBy);
    return toDescriptor(row);
  }

  async deregisterSource(sourceId: string): Promise<void> {
    await this.mgmt.deleteSource(sourceId);
  }

  async discover(query: ToolDiscoveryQuery): Promise<ToolEndpoint[]> {
    const defs = await this.mgmt.listDefinitions(query.tenantId, query.sourceId);
    return defs.map(toEndpoint).filter((ep) => matchDiscoveryQuery(ep, query));
  }

  async resolve(toolId: string, tenantId: string): Promise<ToolEndpoint | null> {
    const def = await this.mgmt.getDefinition(toolId);
    if (!def || def.tenantId !== tenantId) return null;
    return toEndpoint(def);
  }

  async invoke(req: ToolInvocationRequest): Promise<ToolInvocationResult> {
    // 租户隔离前置校验（executeTool 内部不校验 tenantId，invoke 收口补齐，防跨租户调用）
    const def = await this.mgmt.getDefinition(req.toolId);
    if (!def) {
      return { success: false, error: 'tool definition not found', durationMs: 0, logId: '' };
    }
    if (def.tenantId !== req.context.tenantId) {
      return {
        success: false,
        error: 'forbidden: tool does not belong to tenant',
        durationMs: 0,
        logId: '',
      };
    }
    if (!def.enabled) {
      return { success: false, error: 'tool is disabled', durationMs: 0, logId: '' };
    }
    return this.mgmt.executeTool(req.toolId, req.params, req.context);
  }

  async getHealth(sourceId: string): Promise<ToolHealthRecord> {
    const src = await this.sourceRepo.findById(sourceId);
    if (!src) {
      return {
        sourceId,
        status: 'unknown',
        lastCheckAt: null,
        lastError: null,
        consecutiveFailures: 0,
      };
    }
    // P4 接 healthStatus/lastHealthCheckAt/consecutiveFailures 字段前的临时推断：
    // source 状态 error 或有同步错误 → degraded；否则未探活 unknown。
    const hasError = src.status === 'error' || Boolean(src.lastSyncError);
    const status: ToolHealthStatus = hasError ? 'degraded' : 'unknown';
    return {
      sourceId,
      status,
      lastCheckAt: src.lastSyncedAt ? src.lastSyncedAt.getTime() : null,
      lastError: src.lastSyncError ?? null,
      consecutiveFailures: hasError ? 1 : 0,
    };
  }

  async healthCheckAll(_tenantId?: string): Promise<void> {
    // P4 实装：scheduler 定时探活各 source、更新 healthStatus、状态变更触发 notification 告警。
  }
}
