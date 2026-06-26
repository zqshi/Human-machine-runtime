/**
 * ToolSourceService — Source 生命周期(创建/同步/删除)+ 探测 + 连接测试 + spec 上传。
 *
 * 从 ToolManagementService 拆出(委托模式,T45)。public 接口不变,
 * ToolManagementService 委托本 service。内部持有 3 个 parser(openapi/db/gateway)。
 *
 * 凭证解密经共享 helper resolveCredential(credential-resolver.ts),
 * 不再持有 private resolveCredential 方法。
 */
import { newId } from '../../../shared/utils.js';
import type {
  ToolSourceRepository,
  ToolDefinitionRepository,
  ToolSourceRow,
} from '../../../db/repositories/tool-registry-repository.js';
import type {
  CreateSourceInput,
  SyncResult,
  CredentialSecretProvider,
  TestConnectionResult,
} from '../types.js';
import { OpenApiParser } from '../parsers/openapi-parser.js';
import { DbIntrospector, type IntrospectResult } from '../parsers/db-introspector.js';
import { GatewayDiscoverer } from '../parsers/gateway-discoverer.js';
import { resolveCredential } from './credential-resolver.js';

export class ToolSourceService {
  private openapiParser: OpenApiParser;
  private dbIntrospector: DbIntrospector;
  private gatewayDiscoverer: GatewayDiscoverer;

  constructor(
    private sourceRepo: ToolSourceRepository,
    private definitionRepo: ToolDefinitionRepository,
    private credentialSecretProvider: CredentialSecretProvider
  ) {
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

    // 凭证解密(接口漂移修复):经 CredentialSecretProvider 端口解密 source.credentialId。
    // credentialId string → authz.id number 转换;解密失败(id 非法或无 username/password secret)显式报错。
    const credential = await resolveCredential(this.credentialSecretProvider, source.credentialId);
    if (!credential) {
      return {
        success: false,
        toolsCreated: 0,
        toolsUpdated: 0,
        toolsRemoved: 0,
        errors: ['数据库凭证解密失败(credentialId 非法或未配置 username/password secret)'],
      };
    }

    const config = {
      type: (source.dbType || 'postgresql') as 'postgresql' | 'mysql',
      host: source.dbHost,
      port: source.dbPort || 5432,
      database: source.dbName,
      schema: source.dbSchemaName || 'public',
      username: credential.username ?? '',
      password: credential.password ?? '',
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

  /* ──── Introspect Source(独立探测,不落库;供 McpDatabaseFlow 探测→勾选→发布) ──── */

  /**
   * introspectSource — 探测 database source 的表结构,不生成工具不落库。
   *
   * 与 syncSource 区别:sync 探测+生成工具+落库一体(适合"确认发布");
   * 本方法只返回表结构(适合"测试连接并预览 schema",用户勾选后再 sync)。
   * 复用 syncDatabase 的解密+introspect 前半段,不调 generateTools/definitionRepo。
   */
  async introspectSource(sourceId: string): Promise<IntrospectResult> {
    const source = await this.sourceRepo.findById(sourceId);
    if (!source) {
      return { tables: [], errors: ['source not found'] };
    }
    if (source.sourceType !== 'database') {
      return { tables: [], errors: ['introspect 仅支持 database 类型 source'] };
    }
    if (!source.dbHost || !source.dbName || !source.credentialId) {
      return { tables: [], errors: ['数据库连接配置不完整'] };
    }

    const credential = await resolveCredential(this.credentialSecretProvider, source.credentialId);
    if (!credential) {
      return {
        tables: [],
        errors: ['数据库凭证解密失败(credentialId 非法或未配置 username/password secret)'],
      };
    }

    const config = {
      type: (source.dbType || 'postgresql') as 'postgresql' | 'mysql',
      host: source.dbHost,
      port: source.dbPort || 5432,
      database: source.dbName,
      schema: source.dbSchemaName || 'public',
      username: credential.username ?? '',
      password: credential.password ?? '',
    };
    return this.dbIntrospector.introspect(config);
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
        if (!source.credentialId) return { success: false, message: '缺少数据库凭证' };
        // 凭证解密(接口漂移修复):不再用 credentialId 当 username + 空密码占位。
        const credential = await resolveCredential(
          this.credentialSecretProvider,
          source.credentialId
        );
        if (!credential) return { success: false, message: '数据库凭证解密失败' };
        return this.dbIntrospector.testConnection({
          type: (source.dbType || 'postgresql') as 'postgresql' | 'mysql',
          host: source.dbHost,
          port: source.dbPort || 5432,
          database: source.dbName,
          schema: source.dbSchemaName || 'public',
          username: credential.username ?? '',
          password: credential.password ?? '',
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
