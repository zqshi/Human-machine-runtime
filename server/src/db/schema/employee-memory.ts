import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenant.js';
import { instances } from './instance.js';

/* ──── Employee Memory Stores ──── */

export const employeeMemoryStores = pgTable(
  'employee_memory_stores',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    instanceId: varchar('instance_id', { length: 64 })
      .notNull()
      .references(() => instances.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description').notNull().default(''),
    retrievalConfig: jsonb('retrieval_config')
      .$type<{
        topK?: number;
        scoreThreshold?: number;
        maxMemoryAge?: number;
        memoryTypes?: string[];
        useKeywordSearch?: boolean;
        useVectorSearch?: boolean;
        keywordWeight?: number;
        vectorWeight?: number;
      }>()
      .default({}),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    totalFragments: integer('total_fragments').notNull().default(0),
    totalProfiles: integer('total_profiles').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ems_instance').on(table.instanceId),
    index('idx_ems_tenant').on(table.tenantId),
    index('idx_ems_status').on(table.status),
  ]
);

/* ──── Employee Memory Fragments ──── */

export const employeeMemoryFragments = pgTable(
  'employee_memory_fragments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    memoryStoreId: varchar('memory_store_id', { length: 64 })
      .notNull()
      .references(() => employeeMemoryStores.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 }).notNull(),
    departmentId: varchar('department_id', { length: 64 }),
    type: varchar('type', { length: 32 }).notNull().default('fact'),
    scope: varchar('scope', { length: 32 }).notNull().default('personal'),
    content: text('content').notNull(),
    source: varchar('source', { length: 32 }).notNull().default('manual'),
    importance: integer('importance').notNull().default(5),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_emf_store_user').on(table.memoryStoreId, table.userId),
    index('idx_emf_type').on(table.type),
    index('idx_emf_expires').on(table.expiresAt),
    index('idx_emf_store_scope_dept').on(table.memoryStoreId, table.scope, table.departmentId),
  ]
);

/* ──── Employee Memory Rules ──── */

export const employeeMemoryRules = pgTable(
  'employee_memory_rules',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    memoryStoreId: varchar('memory_store_id', { length: 64 })
      .notNull()
      .references(() => employeeMemoryStores.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    ruleType: varchar('rule_type', { length: 32 }).notNull().default('fragment_rule'),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description').notNull().default(''),
    trigger: jsonb('trigger')
      .$type<{
        event?: string;
        conditions?: Record<string, unknown>;
      }>()
      .default({}),
    action: jsonb('action')
      .$type<{
        type?: string;
        params?: Record<string, unknown>;
      }>()
      .default({}),
    priority: integer('priority').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_emr_store_type').on(table.memoryStoreId, table.ruleType),
    index('idx_emr_tenant').on(table.tenantId),
  ]
);
