/**
 * ToolManagementService — 工具管理核心编排服务
 *
 * 职责：
 * - Source 生命周期（创建/同步/删除）
 * - Definition 管理（启停/查询）
 * - Instance 绑定（分配工具给 Agent）
 * - 工具执行代理
 * - 调用统计
 */

import { newId } from '../../shared/utils.js';
import type { CredentialService } from '../credential-vault/credential-service.js';
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
  ExecutionResult,
  ExecutionType,
  DecryptedCredential,
  TestConnectionResult,
  ToolStats,
} from './types.js';
import { OpenApiParser } from './parsers/openapi-parser.js';
import { DbIntrospector } from './parsers/db-introspector.js';
import { GatewayDiscoverer } from './parsers/gateway-discoverer.js';
import { getExecutor } from './executors/executor-factory.js';

export class ToolManagementService {
  private openapiParser: OpenApiParser;
  private dbIntrospector: DbIntrospector;
  private gatewayDiscoverer: GatewayDiscoverer;
  private credentialSvc: CredentialService;

  constructor(
    private sourceRepo: ToolSourceRepository,
    private definitionRepo: ToolDefinitionRepository,
    private instanceRepo: ToolInstanceRepository,
    private callLogRepo: ToolCallLogRepository,
    credentialService: CredentialService
  ) {
    // 保留引用供后续凭证解密使用
    this.credentialSvc = credentialService;
    this.openapiParser = new OpenApiParser();
    this.dbIntrospector = new DbIntrospector();
    this.gatewayDiscoverer = new GatewayDiscoverer();
  }

  /* ──── Source CRUD ──── */

  async listSources(tenantId: string): Promise<ToolSourceRow[]> {
    return this.sourceRepo.findAll(tenantId);
  }

  async getSource(id: string): Promise<ToolSourceRow | null> {
    return this.sourceRepo.findById(id);
  }

  async createSource(
    tenantId: string,
    input: CreateSourceInput,
    createdBy?: string
  ): Promise<ToolSourceRow> {
    const id = newId('tsrc');
    const base = {
      id,
      tenantId,
      sourceType: input.sourceType,
      name: input.name,
      description: input.description ?? null,
      status: 'active' as const,
      createdBy: createdBy ?? null,
    };

    let sourceData: Record<string, unknown> = base;

    switch (input.sourceType) {
      case 'openapi':
        sourceData = {
          ...base,
          specUrl: input.specUrl ?? null,
          specContent: input.specContent ?? null,
          specVersion: input.specVersion ?? null,
          syncStrategy: input.syncStrategy ?? 'manual',
          syncIntervalMin: input.syncIntervalMin ?? null,
        };
        break;
      case 'database':
        sourceData = {
          ...base,
          dbType: input.dbType,
          dbHost: input.dbHost,
          dbPort: input.dbPort,
          dbName: input.dbName,
          dbSchemaName: input.dbSchemaName ?? 'public',
          credentialId: input.credentialId,
        };
        break;
      case 'gateway':
        sourceData = {
          ...base,
          gatewayType: input.gatewayType,
          gatewayUrl: input.gatewayUrl,
          gatewayCredentialId: input.gatewayCredentialId ?? null,
        };
        break;
      case 'mcp_native':
        sourceData = {
          ...base,
          mcpTransport: input.mcpTransport,
          mcpEndpoint: input.mcpEndpoint,
        };
        break;
    }

    return this.sourceRepo.create(sourceData as Parameters<typeof this.sourceRepo.create>[0]);
  }

  async updateSource(id: string, data: Record<string, unknown>): Promise<ToolSourceRow | null> {
    return this.sourceRepo.update(id, data as Parameters<typeof this.sourceRepo.update>[1]);
  }

  async deleteSource(id: string): Promise<void> {
    // 级联删除 definitions（DB 已配置 ON DELETE CASCADE）
    await this.sourceRepo.delete(id);
  }

  /* ──── Sync / Parse ──── */

  async syncSource(sourceId: string): Promise<SyncResult> {
    const source = await this.sourceRepo.findById(sourceId);
    if (!source) {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: ['source not found'],
      };
    }

    await this.sourceRepo.updateSyncStatus(sourceId, { status: 'syncing' });

    try {
      let result: SyncResult;
      switch (source.sourceType) {
        case 'openapi':
          result = await this.syncOpenApi(source);
          break;
        case 'database':
          result = await this.syncDatabase(source);
          break;
        case 'gateway':
          result = await this.syncGateway(source);
          break;
        case 'mcp_native':
          result = { success: true, toolsCreated: 0, toolsUpdated: 0, toolsRemoved: 0, errors: [] };
          break;
        default:
          result = {
            success: false,
            toolsCreated: 0,
            toolsUpdated: 0,
            toolsRemoved: 0,
            errors: [`未知 sourceType: ${source.sourceType}`],
          };
      }

      const defs = await this.definitionRepo.findBySource(sourceId);
      await this.sourceRepo.updateSyncStatus(sourceId, {
        lastSyncedAt: new Date(),
        lastSyncError: result.errors.length > 0 ? result.errors.join('; ') : null,
        status: result.success ? 'active' : 'error',
      });
      await this.sourceRepo.updateToolCount(sourceId, defs.length);

      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.sourceRepo.updateSyncStatus(sourceId, {
        lastSyncError: errMsg,
        status: 'error',
      });
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: [errMsg],
      };
    }
  }

  private async syncOpenApi(source: ToolSourceRow): Promise<SyncResult> {
    let parseResult;
    if (source.specContent) {
      parseResult = this.openapiParser.parse(source.specContent);
    } else if (source.specUrl) {
      parseResult = await this.openapiParser.parseFromUrl(source.specUrl);
    } else {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: ['缺少 specContent 或 specUrl'],
      };
    }

    if (parseResult.tools.length === 0 && parseResult.errors.length > 0) {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: parseResult.errors,
      };
    }

    // 删除旧 definitions，重新创建
    const removed = await this.definitionRepo.deleteBySource(source.id);

    const inserts = parseResult.tools.map((tool) => ({
      id: newId('tdef'),
      sourceId: source.id,
      tenantId: source.tenantId,
      name: tool.name,
      operationId: tool.operationId ?? null,
      method: tool.method ?? null,
      path: tool.path ?? null,
      summary: tool.summary ?? null,
      description: tool.description ?? null,
      inputSchema: tool.inputSchema ?? null,
      outputSchema: tool.outputSchema ?? null,
      authMethod: tool.authMethod ?? 'none',
      executionType: tool.executionType,
      executionConfig: tool.executionConfig,
      tags: tool.tags ?? [],
      enabled: true,
      status: 'active' as const,
    }));

    const created = await this.definitionRepo.createMany(inserts);

    return {
      success: true,
      toolsCreated: created,
      toolsUpdated: 0,
      toolsRemoved: removed,
      errors: parseResult.errors,
    };
  }

  private async syncDatabase(source: ToolSourceRow): Promise<SyncResult> {
    if (!source.dbHost || !source.dbName || !source.credentialId) {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: ['数据库连接配置不完整'],
      };
    }

    // 凭证解密链路探测：CredentialService 当前仅 encrypt/decrypt、无按 credentialId 查询能力
    // （CredentialStore 亦无 db 实现）。能力缺失时显式失败，避免用 credentialId 占位 + 空密码
    // 静默连接产生误导。链路接通（CredentialService.getCredential 实装）后自动走真实凭证。
    const getCredential = (
      this.credentialSvc as {
        getCredential?: (id: string) => Promise<{ username: string; password: string }>;
      }
    ).getCredential;
    if (typeof getCredential !== 'function') {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: ['数据库凭证解密链路未实装（credential-vault 查询/解密待接入），DB 工具同步暂不可用'],
      };
    }
    const credential = await getCredential.call(this.credentialSvc, source.credentialId);

    const config = {
      type: (source.dbType || 'postgresql') as 'postgresql' | 'mysql',
      host: source.dbHost,
      port: source.dbPort || 5432,
      database: source.dbName,
      schema: source.dbSchemaName || 'public',
      username: credential.username,
      password: credential.password,
    };

    const introspectResult = await this.dbIntrospector.introspect(config);
    if (introspectResult.errors.length > 0 && introspectResult.tables.length === 0) {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: introspectResult.errors,
      };
    }

    const tools = this.dbIntrospector.generateTools(introspectResult.tables, config);
    const removed = await this.definitionRepo.deleteBySource(source.id);

    const inserts = tools.map((tool) => ({
      id: newId('tdef'),
      sourceId: source.id,
      tenantId: source.tenantId,
      name: tool.name,
      operationId: null,
      method: null,
      path: null,
      summary: tool.summary ?? null,
      description: tool.description ?? null,
      inputSchema: tool.inputSchema ?? null,
      outputSchema: tool.outputSchema ?? null,
      authMethod: 'none' as const,
      executionType: tool.executionType,
      executionConfig: tool.executionConfig,
      tags: tool.tags ?? [],
      enabled: true,
      status: 'active' as const,
    }));

    const created = await this.definitionRepo.createMany(inserts);

    return {
      success: true,
      toolsCreated: created,
      toolsUpdated: 0,
      toolsRemoved: removed,
      errors: introspectResult.errors,
    };
  }

  private async syncGateway(source: ToolSourceRow): Promise<SyncResult> {
    if (!source.gatewayUrl || !source.gatewayType) {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: ['网关配置不完整'],
      };
    }

    const config = {
      type: source.gatewayType as 'higress' | 'kong' | 'apisix' | 'custom',
      adminUrl: source.gatewayUrl,
      apiKey: undefined as string | undefined,
    };

    const discoverResult = await this.gatewayDiscoverer.discover(config);
    if (discoverResult.errors.length > 0 && discoverResult.routes.length === 0) {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: discoverResult.errors,
      };
    }

    const tools = this.gatewayDiscoverer.generateTools(discoverResult.routes, config);
    const removed = await this.definitionRepo.deleteBySource(source.id);

    const inserts = tools.map((tool) => ({
      id: newId('tdef'),
      sourceId: source.id,
      tenantId: source.tenantId,
      name: tool.name,
      operationId: null,
      method: tool.method ?? null,
      path: tool.path ?? null,
      summary: tool.summary ?? null,
      description: tool.description ?? null,
      inputSchema: tool.inputSchema ?? null,
      outputSchema: tool.outputSchema ?? null,
      authMethod: 'none' as const,
      executionType: tool.executionType,
      executionConfig: tool.executionConfig,
      tags: tool.tags ?? [],
      enabled: true,
      status: 'active' as const,
    }));

    const created = await this.definitionRepo.createMany(inserts);

    return {
      success: true,
      toolsCreated: created,
      toolsUpdated: 0,
      toolsRemoved: removed,
      errors: discoverResult.errors,
    };
  }

  /* ──── Test Connection ──── */

  async testConnection(sourceId: string): Promise<TestConnectionResult> {
    const source = await this.sourceRepo.findById(sourceId);
    if (!source) return { success: false, message: 'source not found' };

    switch (source.sourceType) {
      case 'openapi': {
        if (!source.specUrl) return { success: false, message: '缺少 spec URL' };
        try {
          const res = await fetch(source.specUrl, { signal: AbortSignal.timeout(5000) });
          return { success: res.ok, message: res.ok ? 'URL 可访问' : `HTTP ${res.status}` };
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : String(err) };
        }
      }
      case 'database': {
        if (!source.dbHost || !source.dbName) return { success: false, message: '连接配置不完整' };
        return this.dbIntrospector.testConnection({
          type: (source.dbType || 'postgresql') as 'postgresql' | 'mysql',
          host: source.dbHost,
          port: source.dbPort || 5432,
          database: source.dbName,
          schema: source.dbSchemaName || 'public',
          username: source.credentialId || '',
          password: '',
        });
      }
      case 'gateway': {
        if (!source.gatewayUrl) return { success: false, message: '缺少网关地址' };
        return this.gatewayDiscoverer.testConnection({
          type: (source.gatewayType || 'higress') as 'higress' | 'kong' | 'apisix' | 'custom',
          adminUrl: source.gatewayUrl,
        });
      }
      default:
        return { success: true, message: 'MCP Native 无需测试连接' };
    }
  }

  /* ──── Definition Management ──── */

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

  /* ──── Instance Binding ──── */

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

  /* ──── Execution Proxy ──── */

  async executeTool(
    definitionId: string,
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const definition = await this.definitionRepo.findById(definitionId);
    if (!definition) {
      return { success: false, error: 'tool definition not found', durationMs: 0 };
    }

    if (!definition.enabled) {
      return { success: false, error: 'tool is disabled', durationMs: 0 };
    }

    const executor = getExecutor(definition.executionType as ExecutionType);

    // 解密凭证（如有）
    // 凭证链路未实装：待 credential-vault 提供 getCredential(id) 后，按 source.credentialId
    // 解密获取真实 DB 凭证并注入（见 syncDatabase STUB 注释）。当前恒为 undefined。
    const credential: DecryptedCredential | undefined = undefined;

    const result = await executor.execute(
      definition.executionConfig as Record<string, unknown>,
      params,
      credential
    );

    // 记录调用日志
    await this.callLogRepo.create({
      id: newId('tclog'),
      definitionId,
      instanceId: context.instanceId ?? null,
      tenantId: context.tenantId,
      callerId: context.callerId ?? null,
      inputParams: params,
      outputResult: result.data ? (result.data as Record<string, unknown>) : null,
      durationMs: result.durationMs,
      status: result.success ? 'success' : 'error',
      errorMessage: result.error ?? null,
    });

    // 更新调用计数
    await this.definitionRepo.incrementCallCount(definitionId);

    return result;
  }

  /* ──── Stats ──── */

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

  /* ──── Upload Spec ──── */

  async uploadSpec(
    specContent: string
  ): Promise<{ specVersion: string; title: string; toolCount: number }> {
    const result = this.openapiParser.parse(specContent);
    return {
      specVersion: result.specVersion,
      title: result.title,
      toolCount: result.tools.length,
    };
  }
}
