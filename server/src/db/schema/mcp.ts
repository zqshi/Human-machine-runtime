import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const tenantMcpPolicies = pgTable(
  'tenant_mcp_policies',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    mcpGroupId: varchar('mcp_group_id', { length: 64 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    maxCallsPerDay: integer('max_calls_per_day'),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenant_mcp_policies_unique').on(table.tenantId, table.mcpGroupId),
    index('idx_tenant_mcp_policies_tenant').on(table.tenantId),
  ]
);

export const mcpToolUsage = pgTable(
  'mcp_tool_usage',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    toolName: varchar('tool_name', { length: 128 }).notNull(),
    userId: varchar('user_id', { length: 128 }),
    instanceId: varchar('instance_id', { length: 64 }),
    calledAt: timestamp('called_at', { withTimezone: true }).defaultNow().notNull(),
    durationMs: integer('duration_ms'),
    status: varchar('status', { length: 32 }).notNull().default('success'),
    errorMessage: text('error_message'),
  },
  (table) => [
    index('idx_mcp_usage_tenant').on(table.tenantId),
    index('idx_mcp_usage_tool').on(table.toolName),
    index('idx_mcp_usage_called_at').on(table.calledAt),
  ]
);
