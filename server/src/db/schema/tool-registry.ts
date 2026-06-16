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
