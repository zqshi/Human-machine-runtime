import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';

export const tenants = pgTable(
  'tenants',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    plan: varchar('plan', { length: 32 }).notNull().default('free'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    industry: varchar('industry', { length: 64 }),
    companySize: varchar('company_size', { length: 32 }),
    contactName: varchar('contact_name', { length: 64 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 32 }),
    description: text('description'),
    quotas: jsonb('quotas').$type<Record<string, number>>().default({}),
    features: jsonb('features').$type<Record<string, boolean>>().default({}),
    modelAccess: jsonb('model_access').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tenants_status').on(table.status),
    index('idx_tenants_plan').on(table.plan),
  ]
);

export const quotaAlertRules = pgTable(
  'quota_alert_rules',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    thresholdPct: integer('threshold_pct').notNull(),
    severity: varchar('severity', { length: 16 }).notNull().default('warning'),
    notifyChannels: jsonb('notify_channels').$type<string[]>().default([]),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_quota_alert_rules_tenant').on(table.tenantId)]
);

export const quotaUsageSnapshots = pgTable(
  'quota_usage_snapshots',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    currentValue: real('current_value').notNull(),
    limitValue: real('limit_value').notNull(),
    usagePct: real('usage_pct').notNull(),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    index('idx_quota_usage_snapshots_tenant').on(table.tenantId),
    index('idx_quota_usage_snapshots_measured').on(table.measuredAt),
  ]
);

export const quotaAlertEvents = pgTable(
  'quota_alert_events',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    ruleId: integer('rule_id').references(() => quotaAlertRules.id, { onDelete: 'set null' }),
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    currentPct: real('current_pct').notNull(),
    thresholdPct: integer('threshold_pct').notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_quota_alert_events_tenant').on(table.tenantId),
    index('idx_quota_alert_events_status').on(table.status),
  ]
);

export const userQuotas = pgTable('user_quotas', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  maxInstances: integer('max_instances').notNull().default(10),
  maxCpuCores: integer('max_cpu_cores').notNull().default(16),
  maxMemoryGb: real('max_memory_gb').notNull().default(16.0),
  maxStorageGb: real('max_storage_gb').notNull().default(100.0),
  maxGpuCount: integer('max_gpu_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
