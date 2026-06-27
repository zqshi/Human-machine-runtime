import { pgTable, varchar, jsonb, timestamp, integer, text } from 'drizzle-orm/pg-core';

export const cockpitEntities = pgTable('cockpit_entities', {
  id: varchar('id', { length: 64 }).primaryKey(),
  entityType: varchar('entity_type', { length: 32 }).notNull(),
  tenantId: varchar('tenant_id', { length: 64 }),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: varchar('id', { length: 64 }).primaryKey(),
  title: varchar('title', { length: 256 }),
  type: varchar('type', { length: 32 }),
  read: integer('read').notNull().default(0),
  escalated: integer('escalated').notNull().default(0),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pushChannels = pgTable('push_channels', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }),
  type: varchar('type', { length: 32 }),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const toolConfigs = pgTable('tool_configs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  category: varchar('category', { length: 32 }).notNull(),
  name: varchar('name', { length: 128 }),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiBudgets = pgTable('ai_budgets', {
  id: varchar('id', { length: 64 }).primaryKey(),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiFailoverChains = pgTable('ai_failover_chains', {
  id: varchar('id', { length: 64 }).primaryKey(),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable('workspaces', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 256 }).notNull(),
  type: varchar('type', { length: 32 }).notNull().default('personal'),
  ownerId: varchar('owner_id', { length: 128 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  description: text('description'),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
