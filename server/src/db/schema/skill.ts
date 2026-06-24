import { pgTable, text, varchar, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const skillReports = pgTable(
  'skill_reports',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    assetType: varchar('asset_type', { length: 32 }).notNull().default('skill'),
    sourceTenantId: varchar('source_tenant_id', { length: 64 }).notNull(),
    sourceInstanceId: varchar('source_instance_id', { length: 64 }).notNull(),
    sourceSkillId: varchar('source_skill_id', { length: 64 }),
    name: varchar('name', { length: 256 }).notNull(),
    description: text('description'),
    contentRef: text('content_ref'),
    tags: jsonb('tags').$type<string[]>().default([]),
    version: varchar('version', { length: 32 }).notNull().default('1.0.0'),
    status: varchar('status', { length: 32 }).notNull().default('pending_review'),
    requiredApprovals: integer('required_approvals').notNull().default(1),
    approvals: jsonb('approvals').$type<string[]>().default([]),
    reviewHistory: jsonb('review_history').$type<unknown[]>().default([]),
    reviewedBy: varchar('reviewed_by', { length: 128 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectReason: text('reject_reason'),
    slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
    reviewEscalationLevel: integer('review_escalation_level').notNull().default(0),
    lastEscalatedAt: timestamp('last_escalated_at', { withTimezone: true }),
    escalationHistory: jsonb('escalation_history').$type<unknown[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_skill_reports_status').on(table.status),
    index('idx_skill_reports_tenant').on(table.sourceTenantId),
    index('idx_skill_reports_asset_type').on(table.assetType),
  ]
);

export const sharedAssets = pgTable(
  'shared_assets',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    assetType: varchar('asset_type', { length: 32 }).notNull().default('skill'),
    sourceReportId: varchar('source_report_id', { length: 64 }).notNull(),
    sourceTenantId: varchar('source_tenant_id', { length: 64 }).notNull(),
    sourceInstanceId: varchar('source_instance_id', { length: 64 }).notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    description: text('description'),
    contentRef: text('content_ref'),
    /** v1.4:skill 内联内容(Markdown 文本,组装层注入 prompt)。contentRef 是外部引用,优先读 content。 */
    content: text('content'),
    tags: jsonb('tags').$type<string[]>().default([]),
    version: varchar('version', { length: 32 }).notNull().default('1.0.0'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    publishedBy: varchar('published_by', { length: 128 }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_shared_assets_type').on(table.assetType),
    index('idx_shared_assets_status').on(table.status),
  ]
);

export const assetBindings = pgTable(
  'asset_bindings',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    skillId: varchar('skill_id', { length: 64 }),
    assetId: varchar('asset_id', { length: 64 }),
    assetType: varchar('asset_type', { length: 32 }).notNull().default('skill'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    createdBy: varchar('created_by', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_asset_bindings_tenant').on(table.tenantId),
    index('idx_asset_bindings_type').on(table.assetType),
  ]
);
