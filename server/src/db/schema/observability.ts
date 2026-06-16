import { pgTable, serial, varchar, timestamp, integer, real, index } from 'drizzle-orm/pg-core';

export const tokenUsageSnapshots = pgTable(
  'token_usage_snapshots',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    userUid: varchar('user_uid', { length: 128 }),
    model: varchar('model', { length: 128 }),
    timeBucket: timestamp('time_bucket', { withTimezone: true }).notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    totalCost: real('total_cost').notNull().default(0),
    requestCount: integer('request_count').notNull().default(0),
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_token_usage_tenant').on(table.tenantId),
    index('idx_token_usage_bucket').on(table.timeBucket),
    index('idx_token_usage_model').on(table.model),
  ]
);

export const instanceHealthSnapshots = pgTable(
  'instance_health_snapshots',
  {
    id: serial('id').primaryKey(),
    instanceId: varchar('instance_id', { length: 64 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    cpuUsage: real('cpu_usage'),
    memoryUsage: real('memory_usage'),
    uptimeSeconds: integer('uptime_seconds'),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_instance_health_instance').on(table.instanceId),
    index('idx_instance_health_tenant').on(table.tenantId),
    index('idx_instance_health_checked').on(table.checkedAt),
  ]
);
