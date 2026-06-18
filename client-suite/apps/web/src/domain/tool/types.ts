/**
 * Tool 领域类型定义
 *
 * 纯 type/interface，零外部依赖。
 * infrastructure / application / presentation 各层均从本文件 import 工具相关类型，
 * 避免跨层类型耦合（presentation 不应感知 infrastructure 的文件路径）。
 */

export interface ToolSource {
  id: string;
  tenantId: string;
  sourceType: 'openapi' | 'database' | 'gateway' | 'mcp_native';
  name: string;
  description?: string;
  status: string;
  healthStatus?: 'healthy' | 'degraded' | 'down' | 'unknown';
  toolCount: number;
  specUrl?: string;
  specVersion?: string;
  dbType?: string;
  dbHost?: string;
  dbPort?: number;
  dbName?: string;
  gatewayType?: string;
  gatewayUrl?: string;
  mcpTransport?: string;
  mcpEndpoint?: string;
  syncStrategy?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolDefinition {
  id: string;
  sourceId: string;
  name: string;
  operationId?: string;
  method?: string;
  path?: string;
  summary?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  executionType: string;
  tags?: string[];
  enabled: boolean;
  status: string;
  callCount: number;
  lastCalledAt?: string;
}

export interface ToolInstance {
  id: string;
  definitionId: string;
  tenantId: string;
  instanceId?: string;
  displayName?: string;
  status: string;
}

export interface SyncResult {
  success: boolean;
  toolsCreated: number;
  toolsUpdated: number;
  toolsRemoved: number;
  errors: string[];
}

export interface ToolStats {
  totalSources: number;
  totalDefinitions: number;
  enabledDefinitions: number;
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
}

export interface ToolCallLog {
  id: string;
  definitionId: string;
  callerId?: string;
  durationMs?: number;
  status: string;
  errorMessage?: string;
  calledAt: string;
}
