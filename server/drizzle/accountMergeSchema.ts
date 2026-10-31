import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AccountMergeResult } from '../accountMerge/types';
import { users } from './schema';

export const oauthMergeAuthorizations = pgTable(
  'oauth_merge_authorizations',
  {
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    // The source account and binding are intentionally retained as evidence after
    // a successful merge deletes the source user. They must not cascade away.
    sourceUserId: uuid('source_user_id').notNull(),
    sourceBindingId: uuid('source_binding_id').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, precision: 6 }),
    result: jsonb('result').$type<AccountMergeResult>(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.targetUserId, table.sourceUserId, table.provider, table.providerId],
      name: 'oauth_merge_authorizations_identity_pk',
    }),
    sourceBindingIdx: index('oauth_merge_authorizations_source_binding_idx').on(
      table.sourceBindingId
    ),
    expiresIdx: index('oauth_merge_authorizations_expires_idx').on(table.expiresAt),
    completedIdx: index('oauth_merge_authorizations_completed_idx').on(table.completedAt),
    resultState: check(
      'oauth_merge_authorizations_result_state',
      sql`(${table.completedAt} IS NULL AND ${table.result} IS NULL) OR (${table.completedAt} IS NOT NULL AND ${table.result} IS NOT NULL)`
    ),
  })
);
