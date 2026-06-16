import { pgTable, text, varchar, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenant.js';

export const documents = pgTable(
  'documents',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id),
    roomId: varchar('room_id', { length: 128 }),
    type: varchar('type', { length: 32 }).notNull().default('doc'),
    title: varchar('title', { length: 512 }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().default({}),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    categoryId: varchar('category_id', { length: 64 }),
    departmentId: varchar('department_id', { length: 64 }),
    ownerId: varchar('owner_id', { length: 128 }).notNull(),
    permissions: jsonb('permissions').$type<unknown[]>().default([]),
    createdBy: varchar('created_by', { length: 128 }).notNull(),
    version: integer('version').notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedBy: varchar('reviewed_by', { length: 128 }),
    reviewComment: text('review_comment'),
    wkKnowledgeId: varchar('wk_knowledge_id', { length: 128 }),
    wkSyncStatus: varchar('wk_sync_status', { length: 32 }).default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_documents_tenant').on(table.tenantId),
    index('idx_documents_room').on(table.roomId),
    index('idx_documents_status').on(table.status),
    index('idx_documents_owner').on(table.ownerId),
    index('idx_documents_wk_sync').on(table.wkSyncStatus),
  ]
);

export const documentVersions = pgTable(
  'document_versions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    documentId: varchar('document_id', { length: 64 }).notNull(),
    versionNumber: integer('version_number').notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    editedBy: varchar('edited_by', { length: 128 }).notNull(),
    contentSnapshot: jsonb('content_snapshot'),
    status: varchar('status', { length: 32 }).notNull().default('auto'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_doc_versions_doc').on(table.documentId)]
);

export const knowledgeAudits = pgTable(
  'knowledge_audits',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    operationType: varchar('operation_type', { length: 64 }).notNull(),
    operatorId: varchar('operator_id', { length: 128 }).notNull(),
    operatorName: varchar('operator_name', { length: 128 }).notNull(),
    targetId: varchar('target_id', { length: 128 }).notNull(),
    targetName: varchar('target_name', { length: 512 }),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_knowledge_audits_op').on(table.operationType),
    index('idx_knowledge_audits_time').on(table.timestamp),
  ]
);
