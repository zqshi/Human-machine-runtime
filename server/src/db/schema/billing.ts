import { pgTable, serial, varchar, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * billing 限界上下文 schema(投产骨架,不实现账单生成)。
 *
 * 三张表:
 *   - billing_events:原始计费事件流(append-only)。decision_closed / token_usage / instance_hour 等
 *   - billing_accounts:per-tenant 余额(预付/negative=credit,positive=欠款)
 *   - billing_invoices:账单周期(骨架,本期不写入,留 schema 给后续实现)
 *
 * 金额统一 numeric(12,4) 单位 USD。metadata 保留原始上下文(model/tokens/decisionId...),
 * 用于事后对账与审计。
 */
export const billingEvents = pgTable(
  'billing_events',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 4 }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('USD'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_billing_events_tenant_created').on(table.tenantId, table.createdAt),
    index('idx_billing_events_tenant_type').on(table.tenantId, table.type),
  ]
);

export const billingAccounts = pgTable('billing_accounts', {
  tenantId: varchar('tenant_id', { length: 64 }).primaryKey(),
  balance: numeric('balance', { precision: 12, scale: 4 }).notNull().default('0'),
  currency: varchar('currency', { length: 8 }).notNull().default('USD'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const billingInvoices = pgTable(
  'billing_invoices',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 4 }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('USD'),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_billing_invoices_tenant_period').on(table.tenantId, table.periodStart)]
);
