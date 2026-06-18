/**
 * ToolRegistryService — IToolRegistry 的 application 层实现
 *
 * 参考微服务服务注册/发现：在 ToolManagementService（源/定义/执行）之上封装统一的
 * 注册、发现、健康、调用端口。消费方（管理页路由、Agent 运行时）只依赖 IToolRegistry。
 *
 * 设计：委托 ToolManagementService 复用其 createSource/sync/listDefinitions/executeTool，
 * 避免重复实现；invoke 在 executeTool 之上补齐租户隔离校验并返回 logId；
 * healthCheckAll 由 scheduler 定时触发，探活各 source 并维护 healthStatus。
 */
import { matchDiscoveryQuery, computeHealthStatus } from './tool-registry.js';
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
import { McpClientPool } from './mcp-client.js';
import { logger } from '../../app/logger.js';
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
    health: (src.healthStatus as ToolSourceDescriptor['health']) ?? 'unknown',
  };
}

function timeoutSignal(ms = 5000): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

export class ToolRegistryService implements IToolRegistry {
  constructor(
    private mgmt: ToolManagementService,
    private sourceRepo: ToolSourceRepository,
    private mcpPool: McpClientPool = new McpClientPool()
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
    return {
      sourceId,
      status: (src.healthStatus as ToolHealthStatus) ?? 'unknown',
      lastCheckAt: src.lastHealthCheckAt ? src.lastHealthCheckAt.getTime() : null,
      lastError: src.lastHealthError ?? null,
      consecutiveFailures: src.consecutiveFailures ?? 0,
    };
  }

  async healthCheckAll(_tenantId?: string): Promise<void> {
    const sources = await this.sourceRepo.findAllAll();
    for (const src of sources) {
      if (src.status === 'archived') continue;
      await this.checkSource(src);
    }
  }

  /** 探活单个 source：ping → 计算状态 → 更新 → 转 down 告警。 */
  private async checkSource(src: ToolSourceRow): Promise<void> {
    const result = await this.pingSource(src);
    const prevFailures = src.consecutiveFailures ?? 0;
    const failures = result.ok ? 0 : prevFailures + 1;
    const next = computeHealthStatus(failures);
    await this.sourceRepo.updateHealth(src.id, {
      healthStatus: next,
      lastHealthCheckAt: new Date(),
      lastHealthError: result.error,
      consecutiveFailures: failures,
    });
    const prevStatus = (src.healthStatus as ToolHealthStatus) ?? 'unknown';
    if (prevStatus !== 'down' && next === 'down') {
      logger.warn(
        { sourceId: src.id, sourceName: src.name, tenantId: src.tenantId, error: result.error },
        'tool-source health degraded to down'
      );
      // TODO: 接入 NotificationService 精细告警（邮件/站内）；当前 logger 兜底
    }
  }

  private async pingSource(src: ToolSourceRow): Promise<{ ok: boolean; error: string | null }> {
    try {
      switch (src.sourceType) {
        case 'mcp_native': {
          if (!src.mcpEndpoint) return { ok: false, error: 'MCP endpoint 未配置' };
          const ok = await this.mcpPool.get(src.mcpEndpoint).checkHealth();
          return { ok, error: ok ? null : 'MCP server 不健康' };
        }
        case 'openapi': {
          if (!src.specUrl) return { ok: false, error: 'specUrl 未配置' };
          const res = await fetch(src.specUrl, { method: 'HEAD', signal: timeoutSignal() });
          return { ok: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
        }
        case 'gateway': {
          if (!src.gatewayUrl) return { ok: false, error: 'gatewayUrl 未配置' };
          const res = await fetch(src.gatewayUrl, { method: 'HEAD', signal: timeoutSignal() });
          return { ok: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
        }
        case 'database':
          // DB 探活需凭证链路（service.ts:516 STUB），暂跳过，不误报
          return { ok: true, error: null };
        default:
          return { ok: true, error: null };
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
