import { pgTable, text, varchar, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenant.js';

/* ──── Knowledge Bases ──── */

export const knowledgeBases = pgTable(
  'knowledge_bases',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    wkKnowledgeBaseId: varchar('wk_knowledge_base_id', { length: 128 }).notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    description: text('description').notNull().default(''),
    type: varchar('type', { length: 32 }).notNull().default('document'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    embeddingModelId: varchar('embedding_model_id', { length: 128 }),
    chunkingConfig: jsonb('chunking_config').$type<Record<string, unknown>>().default({}),
    retrievalConfig: jsonb('retrieval_config').$type<Record<string, unknown>>().default({}),
    documentCount: integer('document_count').notNull().default(0),
    boundInstanceIds: jsonb('bound_instance_ids').$type<string[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_kb_tenant').on(table.tenantId),
    index('idx_kb_wk_id').on(table.wkKnowledgeBaseId),
    index('idx_kb_status').on(table.status),
  ]
);

/* ──── Knowledge Entries ──── */

export const knowledgeEntries = pgTable(
  'knowledge_entries',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    knowledgeBaseId: varchar('knowledge_base_id', { length: 64 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    wkKnowledgeId: varchar('wk_knowledge_id', { length: 128 }).notNull(),
    dcfDocumentId: varchar('dcf_document_id', { length: 64 }),
    title: varchar('title', { length: 512 }).notNull(),
    sourceType: varchar('source_type', { length: 32 }).notNull().default('manual'),
    parseStatus: varchar('parse_status', { length: 32 }).notNull().default('pending'),
    chunkCount: integer('chunk_count').notNull().default(0),
    fileSize: integer('file_size').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ke_kb').on(table.knowledgeBaseId),
    index('idx_ke_tenant').on(table.tenantId),
    index('idx_ke_dcf_doc').on(table.dcfDocumentId),
  ]
);

/* ──── WeKnora Tenant Mappings ──── */

export const weknoTenantMappings = pgTable(
  'weknora_tenant_mappings',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    dcfTenantId: varchar('dcf_tenant_id', { length: 64 })
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    wkTenantId: varchar('wk_tenant_id', { length: 128 }).notNull(),
    wkUserId: varchar('wk_user_id', { length: 128 }).notNull(),
    wkApiKey: text('wk_api_key').notNull(),
    wkBaseUrl: varchar('wk_base_url', { length: 512 }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    defaultKbId: varchar('default_kb_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_wk_mapping_tenant').on(table.dcfTenantId),
    index('idx_wk_mapping_status').on(table.status),
  ]
);
