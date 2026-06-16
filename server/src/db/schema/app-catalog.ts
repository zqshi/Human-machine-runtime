import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const appCatalog = pgTable(
  'app_catalog',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    icon: varchar('icon', { length: 64 }).notNull(),
    iconColor: varchar('icon_color', { length: 16 }).notNull().default('#007AFF'),
    category: varchar('category', { length: 64 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(0),
    visible: boolean('visible').notNull().default(true),
    tenantId: varchar('tenant_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_app_catalog_category').on(table.category),
    index('idx_app_catalog_tenant').on(table.tenantId),
  ]
);
