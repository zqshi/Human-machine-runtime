import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uuid,
} from 'drizzle-orm/pg-core';

export const authProviders = pgTable(
  'auth_providers',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 128 }).notNull(),
    authType: varchar('auth_type', { length: 32 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 }),
    enabled: boolean('enabled').notNull().default(true),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_auth_providers_tenant').on(table.tenantId),
    index('idx_auth_providers_type').on(table.authType),
  ]
);

export const userAuthorizations = pgTable(
  'user_authorizations',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull(),
    providerId: integer('provider_id').notNull(),
    externalAccountId: varchar('external_account_id', { length: 256 }),
    scope: varchar('scope', { length: 256 }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_user_authz_user').on(table.userId),
    index('idx_user_authz_provider').on(table.providerId),
  ]
);

export const credentialSecrets = pgTable(
  'credential_secrets',
  {
    id: serial('id').primaryKey(),
    authorizationId: integer('authorization_id').notNull(),
    secretType: varchar('secret_type', { length: 32 }).notNull(),
    ciphertext: text('ciphertext').notNull(),
    keyVersion: integer('key_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_cred_secrets_authz').on(table.authorizationId)]
);

export const credentialLeases = pgTable(
  'credential_leases',
  {
    id: serial('id').primaryKey(),
    leaseId: uuid('lease_id').notNull().defaultRandom().unique(),
    userId: integer('user_id').notNull(),
    providerId: integer('provider_id').notNull(),
    scope: varchar('scope', { length: 256 }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_cred_leases_user').on(table.userId),
    index('idx_cred_leases_lease').on(table.leaseId),
    index('idx_cred_leases_expires').on(table.expiresAt),
  ]
);

export const oauthStates = pgTable(
  'oauth_states',
  {
    id: serial('id').primaryKey(),
    state: varchar('state', { length: 128 }).notNull().unique(),
    userId: integer('user_id').notNull(),
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    redirectUri: text('redirect_uri').notNull(),
    codeVerifier: varchar('code_verifier', { length: 128 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_oauth_states_expires').on(table.expiresAt)]
);
