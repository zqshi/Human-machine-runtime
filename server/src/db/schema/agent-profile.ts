import { pgTable, text, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const agentProfiles = pgTable(
  'agent_profiles',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    instanceId: varchar('instance_id', { length: 64 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 128 }),
    avatar: text('avatar'),
    knowMe: text('know_me'),
    skillsDigest: text('skills_digest'),
    personality: text('personality'),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}),
    milestones: jsonb('milestones').$type<unknown[]>().default([]),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_agent_profiles_instance').on(table.instanceId),
    index('idx_agent_profiles_tenant').on(table.tenantId),
  ]
);
