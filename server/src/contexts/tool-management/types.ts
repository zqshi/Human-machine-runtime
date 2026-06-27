/* ──── Tool Management Domain Types ──── */

export type SourceType = 'openapi' | 'database' | 'gateway' | 'mcp_native';
export type ExecutionType = 'http_proxy' | 'db_query' | 'gateway_route' | 'mcp_call' | 'sandbox';
export type AuthMethod = 'none' | 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
export type SyncStrategy = 'manual' | 'on_change' | 'periodic';
export type SourceStatus = 'active' | 'syncing' | 'error' | 'archived';
export type DefinitionStatus = 'active' | 'deprecated' | 'draft';
export type GatewayType = 'higress' | 'kong' | 'apisix' | 'custom';
export type DbType = 'postgresql' | 'mysql';
/** v1.9:工具风险等级(#7 执行时 Human Review,决定是否需人工审批) */
export type RiskLevel = 'low' | 'medium' | 'high';

/* ──── Source Creation Inputs ──── */

export interface CreateOpenApiSourceInput {
  sourceType: 'openapi';
  name: string;
  description?: string;
  specUrl?: string;
  specContent?: string;
  specVersion?: string;
  syncStrategy?: SyncStrategy;
  syncIntervalMin?: number;
}

export interface CreateDatabaseSourceInput {
  sourceType: 'database';
  name: string;
  description?: string;
  dbType: DbType;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbSchemaName?: string;
  credentialId: string;
}

export interface CreateGatewaySourceInput {
  sourceType: 'gateway';
  name: string;
  description?: string;
  gatewayType: GatewayType;
  gatewayUrl: string;
  gatewayCredentialId?: string;
}

export interface CreateMcpNativeSourceInput {
  sourceType: 'mcp_native';
  name: string;
  description?: string;
  mcpTransport: string;
  mcpEndpoint: string;
}

export type CreateSourceInput =
  | CreateOpenApiSourceInput
  | CreateDatabaseSourceInput
  | CreateGatewaySourceInput
  | CreateMcpNativeSourceInput;

/* ──── Parsed Tool (output of parsers) ──── */

export interface ParsedTool {
  name: string;
  operationId?: string;
  method?: string;
  path?: string;
  summary?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  authMethod?: AuthMethod;
  executionType: ExecutionType;
  executionConfig: Record<string, unknown>;
  tags?: string[];
}

/* ──── Sync Result ──── */

export interface SyncResult {
  success: boolean;
  toolsCreated: number;
  toolsUpdated: number;
  toolsRemoved: number;
  errors: string[];
}

/* ──── Execution ──── */

export interface ExecutionContext {
  tenantId: string;
  callerId?: string;
  instanceId?: string;
  timeout?: number;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
  httpStatus?: number;
}

/* ──── Tool Executor Interface ──── */

export interface IToolExecutor {
  execute(
    config: Record<string, unknown>,
    params: Record<string, unknown>,
    credential?: DecryptedCredential
  ): Promise<ExecutionResult>;
}

export interface DecryptedCredential {
  type: string;
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  headerName?: string;
  connectionString?: string;
}

/**
 * 凭证解密端口(依赖倒置,§1)。
 * tool-management 解密 DB/API 凭证时依赖此端口,credential-vault 的
 * CredentialManagementService 实现之(getCredentialSecret 已就绪)。
 * 避免 tool-management 跨聚合直接依赖 credential-vault application 层,
 * 亦避免依赖 domain CredentialService(仅 encrypt/decrypt 原语,无"按 id 查"能力)。
 */
export interface CredentialSecretProvider {
  /** 按 credentialId + secretType 解密返回明文;密文不存在返回 null。 */
  getCredentialSecret(id: number, secretType: string): Promise<string | null>;
}

/* ──── Test Connection ──── */

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/* ──── Stats ──── */

export interface ToolStats {
  totalSources: number;
  totalDefinitions: number;
  enabledDefinitions: number;
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
}
