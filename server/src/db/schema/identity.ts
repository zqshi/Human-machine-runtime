import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 64 }).notNull().unique(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 32 }).notNull().default('user'),
    scope: varchar('scope', { length: 32 }).notNull().default('tenant'),
    tenantId: varchar('tenant_id', { length: 64 }),
    displayName: varchar('display_name', { length: 128 }),
    avatarUrl: text('avatar_url'),
    kscSubject: varchar('ksc_subject', { length: 191 }),
    externalSubject: varchar('external_subject', { length: 191 }),
    isActive: boolean('is_active').notNull().default(true),
    source: varchar('source', { length: 32 }).notNull().default('env'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_role').on(table.role),
    index('idx_users_email').on(table.email),
    index('idx_users_tenant').on(table.tenantId),
    uniqueIndex('idx_users_ksc_subject').on(table.kscSubject),
    uniqueIndex('idx_users_external_subject').on(table.externalSubject),
  ]
);

export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  permissions: jsonb('permissions').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userRoleAssignments = pgTable(
  'user_role_assignments',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => userRoles.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    assignedBy: varchar('assigned_by', { length: 64 }),
  },
  (table) => [uniqueIndex('user_role_assignments_unique').on(table.userId, table.roleId)]
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerType: varchar('provider_type', { length: 32 }).notNull(),
    externalId: varchar('external_id', { length: 256 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    upstreamToken: text('upstream_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_sessions_user').on(table.userId),
    index('idx_sessions_expires').on(table.expiresAt),
  ]
);

export const tenantAuthConfigs = pgTable(
  'tenant_auth_configs',
  {
    id: serial('id').primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    providerType: varchar('provider_type', { length: 32 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    priority: integer('priority').notNull().default(0),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenant_auth_configs_unique').on(table.tenantId, table.providerType),
    index('idx_tenant_auth_configs_tenant').on(table.tenantId),
  ]
);

export const externalIdentities = pgTable(
  'external_identities',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerType: varchar('provider_type', { length: 32 }).notNull(),
    externalId: varchar('external_id', { length: 256 }).notNull(),
    email: varchar('email', { length: 255 }),
    displayName: varchar('display_name', { length: 128 }),
    avatarUrl: text('avatar_url'),
    rawClaims: jsonb('raw_claims').$type<Record<string, unknown>>(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('external_identities_unique').on(table.providerType, table.externalId),
    index('idx_external_identities_user').on(table.userId),
  ]
);
