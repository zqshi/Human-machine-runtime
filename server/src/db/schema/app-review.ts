import { pgTable, serial, text, varchar, timestamp, index } from 'drizzle-orm/pg-core';

export const appReviews = pgTable(
  'app_reviews',
  {
    id: serial('id').primaryKey(),
    appId: varchar('app_id', { length: 64 }).notNull(),
    xspaceAppId: varchar('xspace_app_id', { length: 64 }),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    submitter: varchar('submitter', { length: 128 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    reviewer: varchar('reviewer', { length: 128 }),
    reviewNote: text('review_note'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_app_reviews_tenant').on(table.tenantId),
    index('idx_app_reviews_status').on(table.status),
    index('idx_app_reviews_app').on(table.appId),
  ]
);
