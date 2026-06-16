import { pgTable, serial, text, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    scope: varchar('scope', { length: 32 }).notNull(),
    module: varchar('module', { length: 64 }),
    operation: varchar('operation', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }),
    actorId: varchar('actor_id', { length: 128 }),
    actorName: varchar('actor_name', { length: 128 }),
    resourceId: varchar('resource_id', { length: 128 }),
    resourceType: varchar('resource_type', { length: 64 }),
    details: jsonb('details'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_logs_scope').on(table.scope),
    index('idx_audit_logs_module').on(table.module),
    index('idx_audit_logs_created').on(table.createdAt),
  ]
);
