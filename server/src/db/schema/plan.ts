import {
  pgTable,
  varchar,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const servicePlans = pgTable(
  'service_plans',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    displayOrder: integer('display_order').notNull().default(0),
    description: text('description'),
    isDefault: boolean('is_default').notNull().default(false),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    quotaTemplate: jsonb('quota_template').$type<Record<string, unknown>>().default({}),
    featureTemplate: jsonb('feature_template').$type<Record<string, boolean>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_service_plans_slug').on(table.slug)]
);
