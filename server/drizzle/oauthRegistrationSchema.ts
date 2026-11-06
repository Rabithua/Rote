import { boolean, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// A verified provider identity can create one account after its owner chooses a username.
// Only the digest of the short-lived browser credential is retained.
export const oauthRegistrationAuthorizations = pgTable(
  'oauth_registration_authorizations',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    providerUsername: varchar('provider_username', { length: 255 }),
    suggestedUsername: varchar('suggested_username', { length: 20 }).notNull(),
    avatar: text('avatar'),
    frontendBaseUrl: text('frontend_base_url').notNull(),
    redirectUrl: text('redirect_url').notNull(),
    iosLogin: boolean('ios_login').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    expiresIdx: index('oauth_registration_authorizations_expires_idx').on(table.expiresAt),
  })
);
