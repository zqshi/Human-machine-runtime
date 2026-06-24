import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/* ──── Tool Sources ──── */

export const toolSources = pgTable(
  'tool_sources',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    sourceType: varchar('source_type', { length: 32 }).notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    description: text('description'),
    // OpenAPI
    specUrl: text('spec_url'),
    specContent: text('spec_content'),
    specVersion: varchar('spec_version', { length: 16 }),
    // Database
    dbType: varchar('db_type', { length: 32 }),
    dbHost: text('db_host'),
    dbPort: integer('db_port'),
    dbName: varchar('db_name', { length: 128 }),
    dbSchemaName: varchar('db_schema_name', { length: 128 }).default('public'),
    credentialId: varchar('credential_id', { length: 64 }),
    // Gateway
    gatewayType: varchar('gateway_type', { length: 32 }),
    gatewayUrl: text('gateway_url'),
    gatewayCredentialId: varchar('gateway_credential_id', { length: 64 }),
    // MCP Native
    mcpTransport: varchar('mcp_transport', { length: 32 }),
    mcpEndpoint: text('mcp_endpoint'),
    // Sync
    syncStrategy: varchar('sync_strategy', { length: 32 }).default('manual'),
    syncIntervalMin: integer('sync_interval_min'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastSyncError: text('last_sync_error'),
    // Status
    status: varchar('status', { length: 32 }).notNull().default('active'),
    // 健康检查状态（P4：scheduler 定时探活维护）
    healthStatus: varchar('health_status', { length: 32 }).notNull().default('unknown'),
    lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
    lastHealthError: text('last_health_error'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    toolCount: integer('tool_count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdBy: varchar('created_by', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tool_sources_tenant').on(table.tenantId),
    index('idx_tool_sources_type').on(table.sourceType),
    index('idx_tool_sources_status').on(table.status),
  ]
);

/* ──── Tool Definitions ──── */

export const toolDefinitions = pgTable(
  'tool_definitions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    operationId: varchar('operation_id', { length: 256 }),
    method: varchar('method', { length: 16 }),
    path: varchar('path', { length: 512 }),
    summary: text('summary'),
    description: text('description'),
    inputSchema: jsonb('input_schema').$type<Record<string, unknown>>(),
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(),
    authMethod: varchar('auth_method', { length: 32 }).default('none'),
    executionType: varchar('execution_type', { length: 32 }).notNull(),
    executionConfig: jsonb('execution_config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    tags: jsonb('tags').$type<string[]>().default([]),
    version: varchar('version', { length: 32 }).default('1.0.0'),
    enabled: boolean('enabled').notNull().default(true),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    /** v1.9:风险等级(#7 执行时 Human Review,决定是否需人工审批) */
    riskLevel: varchar('risk_level', { length: 16 }).notNull().default('medium'),
    callCount: integer('call_count').notNull().default(0),
    lastCalledAt: timestamp('last_called_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tool_definitions_source').on(table.sourceId),
    index('idx_tool_definitions_tenant').on(table.tenantId),
    index('idx_tool_definitions_status').on(table.status),
    index('idx_tool_definitions_name').on(table.name),
  ]
);

/* ──── Tool Instances ──── */

export const toolInstances = pgTable(
  'tool_instances',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    definitionId: varchar('definition_id', { length: 64 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    instanceId: varchar('instance_id', { length: 64 }),
    credentialId: varchar('credential_id', { length: 64 }),
    displayName: varchar('display_name', { length: 256 }),
    policy: jsonb('policy').$type<Record<string, unknown>>().default({}),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tool_instances_definition').on(table.definitionId),
    index('idx_tool_instances_tenant').on(table.tenantId),
    index('idx_tool_instances_instance').on(table.instanceId),
  ]
);

/* ──── Tool Call Logs ──── */

export const toolCallLogs = pgTable(
  'tool_call_logs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    definitionId: varchar('definition_id', { length: 64 }).notNull(),
    instanceId: varchar('instance_id', { length: 64 }),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    callerId: varchar('caller_id', { length: 128 }),
    inputParams: jsonb('input_params').$type<Record<string, unknown>>(),
    outputResult: jsonb('output_result').$type<Record<string, unknown>>(),
    durationMs: integer('duration_ms'),
    status: varchar('status', { length: 32 }).notNull().default('success'),
    errorMessage: text('error_message'),
    calledAt: timestamp('called_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tool_call_logs_definition').on(table.definitionId),
    index('idx_tool_call_logs_tenant').on(table.tenantId),
    index('idx_tool_call_logs_called_at').on(table.calledAt),
    index('idx_tool_call_logs_status').on(table.status),
  ]
);

/* ──── v1.9: Tool Approvals(#7 执行时 Human Review 审批队列) ──── */

/**
 * tool_approvals — 高风险工具调用的人工审批队列。
 *
 * gate 拦截需审批的工具调用 → 创建 pending 记录(存 toolId/params/context 快照)。
 * admin approve → 触发实际 executeTool,结果存 result;reject → 标记拒绝。
 * 复刻 marketplace IApprovalStore 的 pending/approved/rejected 语义。
 */
export type ToolApprovalStatus = 'pending' | 'approved' | 'rejected';

export const toolApprovals = pgTable(
  'tool_approvals',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    toolId: varchar('tool_id', { length: 64 }).notNull(),
    toolName: varchar('tool_name', { length: 256 }).notNull(),
    /** 触发审批时的风险等级 */
    riskLevel: varchar('risk_level', { length: 16 }).notNull(),
    /** 实例 id(可空,工具调用未必绑定实例) */
    instanceId: varchar('instance_id', { length: 64 }),
    /** 调用参数快照(审批后续执行用) */
    params: jsonb('params').$type<Record<string, unknown>>().notNull(),
    /** 执行上下文快照(tenantId/callerId/instanceId/timeout) */
    context: jsonb('context').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    requestedBy: varchar('requested_by', { length: 128 }),
    reviewedBy: varchar('reviewed_by', { length: 128 }),
    reviewNote: text('review_note'),
    /** 审批通过后实际执行的返回结果快照 */
    result: jsonb('result').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_tool_approvals_tenant').on(table.tenantId),
    index('idx_tool_approvals_status').on(table.status),
    index('idx_tool_approvals_instance').on(table.instanceId),
  ]
);
