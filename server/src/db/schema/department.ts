import { pgTable, text, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenant.js';

/* ──── Departments ──── */

export const departments = pgTable(
  'departments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_departments_tenant').on(table.tenantId),
    uniqueIndex('uq_departments_tenant_slug').on(table.tenantId, table.slug),
    uniqueIndex('uq_departments_tenant_name').on(table.tenantId, table.name),
  ]
);
