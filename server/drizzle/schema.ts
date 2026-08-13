import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// 定义 bytea 类型
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value: Buffer) => value,
  fromDriver: (value: Buffer) => value,
});

// Users 表
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    username: varchar('username', { length: 100 }).notNull().unique(),
    // 邮箱是否已验证
    emailVerified: boolean('emailVerified').notNull().default(false),
    passwordhash: bytea('passwordhash'),
    salt: bytea('salt'),
    // 注意：authProvider, authProviderId, authProviderUsername 已移除
    // 主登录方式可以通过 passwordhash 和 user_oauth_bindings 表推断：
    // - 如果有 passwordhash，主登录方式是 'local'
    // - 如果没有 passwordhash 但有 oauthBindings，主登录方式是第一个绑定的提供商
    nickname: varchar('nickname', { length: 255 }),
    description: text('description'),
    cover: text('cover'),
    avatar: text('avatar'),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    role: varchar('role', { length: 50 }).notNull().default('user'),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    usernameIdx: index('users_username_idx').on(table.username),
    // 注意：authProvider 相关索引已移除，OAuth 绑定信息存储在 user_oauth_bindings 表中
  })
);

// Account-level user block relationships.
export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerId: uuid('blockerId').notNull(),
    blockedId: uuid('blockedId').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({
      columns: [table.blockerId, table.blockedId],
      name: 'user_blocks_blocker_blocked_pk',
    }),
    blockerIdx: index('user_blocks_blocker_id_idx').on(table.blockerId),
    blockedIdx: index('user_blocks_blocked_id_idx').on(table.blockedId),
    blockerFk: foreignKey({
      columns: [table.blockerId],
      foreignColumns: [users.id],
      name: 'user_blocks_blocker_id_users_id_fk',
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    blockedFk: foreignKey({
      columns: [table.blockedId],
      foreignColumns: [users.id],
      name: 'user_blocks_blocked_id_users_id_fk',
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    noSelfBlock: check('user_blocks_no_self_block', sql`${table.blockerId} <> ${table.blockedId}`),
  })
);

// User Settings 表
export const userSettings = pgTable(
  'user_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userid: uuid('userid').notNull().unique(),
    darkmode: boolean('darkmode').notNull().default(false),
    // 是否允许公开笔记出现在探索页
    allowExplore: boolean('allowExplore').notNull().default(true),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    useridIdx: index('user_settings_userid_idx').on(table.userid),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

export const rolePermissionPolicies = pgTable(
  'role_permission_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    role: varchar('role', { length: 50 }).notNull(),
    permission: varchar('permission', { length: 100 }).notNull(),
    effect: varchar('effect', { length: 10 }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    roleIdx: index('role_permission_policies_role_idx').on(table.role),
    uniqueRolePermission: unique('unique_role_permission').on(table.role, table.permission),
  })
);

export const userPermissionOverrides = pgTable(
  'user_permission_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userid: uuid('userid').notNull(),
    permission: varchar('permission', { length: 100 }).notNull(),
    effect: varchar('effect', { length: 10 }).notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true, precision: 6 }),
    reason: text('reason'),
    updatedBy: uuid('updatedBy'),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    useridIdx: index('user_permission_overrides_userid_idx').on(table.userid),
    uniqueUserPermission: unique('unique_user_permission').on(table.userid, table.permission),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    updatedByFk: foreignKey({
      columns: [table.updatedBy],
      foreignColumns: [users.id],
    })
      .onDelete('set null')
      .onUpdate('cascade'),
  })
);

// Paid Server projected subscription grants. The user ID is the aggregate key so
// every user has at most one complete billing snapshot.
export const billingGrants = pgTable(
  'billing_grants',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    issuer: varchar('issuer', { length: 100 }).notNull(),
    instanceId: varchar('instance_id', { length: 100 }).notNull(),
    revision: bigint('revision', { mode: 'bigint' }).notNull(),
    planId: varchar('plan_id', { length: 50 }),
    status: varchar('status', { length: 32 }).notNull(),
    productId: varchar('product_id', { length: 255 }),
    entitlementExpiresAt: timestamp('entitlement_expires_at', {
      withTimezone: true,
      precision: 6,
    }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, precision: 6 }),
    capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]),
    benefits: jsonb('benefits').$type<{
      storage: { baseBytes: string; bonusBytes: string; quotaBytes: string };
      openKey: { creationPolicy: 'unlimited' };
    } | null>(),
    snapshotHash: varchar('snapshot_hash', { length: 64 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    leaseExpiresAtIdx: index('billing_grants_lease_expires_at_idx').on(table.leaseExpiresAt),
    revisionNonNegative: check('billing_grants_revision_non_negative', sql`${table.revision} >= 0`),
    validStatus: check(
      'billing_grants_valid_status',
      sql`${table.status} IN ('active', 'grace_period', 'none')`
    ),
  })
);

// Authenticated inbound request ledger. Its composite key intentionally omits
// key_id so rotating a signing key cannot cause a delivery to execute twice.
export const billingInboundDeliveries = pgTable(
  'billing_inbound_deliveries',
  {
    direction: varchar('direction', { length: 32 }).notNull(),
    deliveryId: uuid('delivery_id').notNull(),
    keyId: varchar('key_id', { length: 100 }).notNull(),
    requestTarget: text('request_target').notNull(),
    bodyHash: varchar('body_hash', { length: 64 }).notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body').$type<{
      code: number;
      message: string;
      data: unknown;
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, precision: 6 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.direction, table.deliveryId] }),
    createdAtIdx: index('billing_inbound_deliveries_created_at_idx').on(table.createdAt),
    paidToRoteDirection: check(
      'billing_inbound_deliveries_paid_to_rote_direction',
      sql`${table.direction} = 'paid_to_rote'`
    ),
  })
);

export const resourceStorageAccounts = pgTable('resource_storage_accounts', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  usedBytes: bigint('used_bytes', { mode: 'bigint' })
    .notNull()
    .default(sql`0`),
  reservedBytes: bigint('reserved_bytes', { mode: 'bigint' })
    .notNull()
    .default(sql`0`),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true, precision: 6 }),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const resourceManagementState = pgTable('resource_management_state', {
  id: varchar('id', { length: 32 }).primaryKey(),
  cleanupFuseTripped: boolean('cleanup_fuse_tripped').notNull().default(false),
  reconciliationStatus: varchar('reconciliation_status', { length: 32 })
    .notNull()
    .default('pending'),
  reconciliationStartedAt: timestamp('reconciliation_started_at', {
    withTimezone: true,
    precision: 6,
  }),
  reconciliationCompletedAt: timestamp('reconciliation_completed_at', {
    withTimezone: true,
    precision: 6,
  }),
  reconciliationLastError: text('reconciliation_last_error'),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const resourceStorageObjects = pgTable(
  'resource_storage_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    storageIdentity: varchar('storage_identity', { length: 255 }).notNull(),
    objectKey: text('object_key').notNull(),
    role: varchar('role', { length: 32 }).notNull(),
    actualBytes: bigint('actual_bytes', { mode: 'bigint' }).notNull(),
    billable: boolean('billable').notNull(),
    referenceCount: integer('reference_count').notNull().default(1),
    state: varchar('state', { length: 32 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueStorageObject: unique('resource_storage_objects_identity_key_unique').on(
      table.storageIdentity,
      table.objectKey
    ),
    ownerIdx: index('resource_storage_objects_owner_idx').on(table.ownerId),
  })
);

export const resourceUploadReservations = pgTable(
  'resource_upload_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    grantRevision: bigint('grant_revision', { mode: 'bigint' }),
    grantProDerived: boolean('grant_pro_derived').notNull().default(false),
    grantEntitlementExpiresAt: timestamp('grant_entitlement_expires_at', {
      withTimezone: true,
      precision: 6,
    }),
    manifest: jsonb('manifest').$type<unknown[]>().notNull(),
    reservedBytes: bigint('reserved_bytes', { mode: 'bigint' }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }).notNull(),
    credentialExpiresAt: timestamp('credential_expires_at', { withTimezone: true, precision: 6 }),
    result: jsonb('result'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, precision: 6 }),
  },
  (table) => ({
    userStatusIdx: index('resource_upload_reservations_user_status_idx').on(
      table.userId,
      table.status
    ),
    statusExpiryIdx: index('resource_upload_reservations_status_expiry_idx').on(
      table.status,
      table.expiresAt
    ),
  })
);

export const resourceCleanupOutbox = pgTable(
  'resource_cleanup_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storageIdentity: varchar('storage_identity', { length: 255 }).notNull(),
    objectKey: text('object_key').notNull(),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, precision: 6 }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    uniquePendingObject: unique('resource_cleanup_outbox_identity_key_unique').on(
      table.storageIdentity,
      table.objectKey
    ),
    pendingAttemptIdx: index('resource_cleanup_outbox_pending_attempt_idx').on(
      table.completedAt,
      table.nextAttemptAt
    ),
  })
);

// User Open Keys 表
export const userOpenKeys = pgTable(
  'user_open_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userid: uuid('userid').notNull(),
    permissions: text('permissions').array().notNull().default(['SENDROTE']),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    useridIdx: index('user_open_keys_userid_idx').on(table.userid),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// OpenKey 使用日志表
export const openKeyUsageLogs = pgTable(
  'open_key_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    openKeyId: uuid('openKeyId').notNull(),
    endpoint: varchar('endpoint', { length: 255 }).notNull(),
    method: varchar('method', { length: 10 }).notNull(),
    clientIp: varchar('clientIp', { length: 45 }),
    userAgent: text('userAgent'),
    statusCode: integer('statusCode'),
    responseTime: integer('responseTime'),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    openKeyIdIdx: index('open_key_usage_logs_openKeyId_idx').on(table.openKeyId),
    createdAtIdx: index('open_key_usage_logs_createdAt_idx').on(table.createdAt),
    openKeyIdFk: foreignKey({
      columns: [table.openKeyId],
      foreignColumns: [userOpenKeys.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// AI Token 使用日志表
export const aiTokenUsageLogs = pgTable(
  'ai_token_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userid: uuid('userid').notNull(),
    model: varchar('model', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 'chat' | 'embedding'
    promptTokens: integer('promptTokens').notNull().default(0),
    completionTokens: integer('completionTokens').notNull().default(0),
    totalTokens: integer('totalTokens').notNull().default(0),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    useridIdx: index('ai_token_usage_logs_userid_idx').on(table.userid),
    createdAtIdx: index('ai_token_usage_logs_createdAt_idx').on(table.createdAt),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// User SW Subscriptions 表
export const userSwSubscriptions = pgTable(
  'user_sw_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userid: uuid('userid').notNull(),
    endpoint: text('endpoint').notNull().unique(),
    note: text('note').default(''),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    expirationTime: text('expirationTime'),
    keys: jsonb('keys').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    useridIdx: index('user_sw_subscriptions_userid_idx').on(table.userid),
    endpointIdx: index('user_sw_subscriptions_endpoint_idx').on(table.endpoint),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// Articles 表
export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    authorId: uuid('authorId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    authorIdIdx: index('articles_authorId_idx').on(table.authorId),
  })
);

// Rotes 表
export const rotes = pgTable(
  'rotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').default(''),
    type: varchar('type', { length: 100 }).default('Rote'),
    tags: text('tags').array().notNull().default([]),
    content: text('content').notNull(),
    state: varchar('state', { length: 50 }).notNull().default('private'),
    archived: boolean('archived').notNull().default(false),
    authorid: uuid('authorid').notNull(),
    // 单篇文章引用：可为空
    articleId: uuid('articleId'),
    pin: boolean('pin').notNull().default(false),
    editor: varchar('editor', { length: 100 }).default('normal'),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    authoridStateIdx: index('rotes_authorid_state_idx').on(table.authorid, table.state),
    authoridArchivedIdx: index('rotes_authorid_archived_idx').on(table.authorid, table.archived),
    authoridCreatedAtIdx: index('rotes_authorid_created_at_idx').on(
      table.authorid,
      table.createdAt
    ),
    tagsGinIdx: index('rotes_tags_idx').using('gin', table.tags),
    authoridFk: foreignKey({
      columns: [table.authorid],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    articleIdIdx: index('rotes_articleId_idx').on(table.articleId),
    articleIdFk: foreignKey({
      columns: [table.articleId],
      foreignColumns: [articles.id],
    })
      .onDelete('set null')
      .onUpdate('cascade'),
  })
);

// Attachments 表
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull(),
    compressUrl: text('compressUrl').default(''),
    posterUrl: text('posterUrl').default(''),
    userid: uuid('userid'),
    roteid: uuid('roteid'),
    storage: varchar('storage', { length: 100 }).notNull(),
    details: jsonb('details').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    sortIndex: integer('sortIndex').default(0),
  },
  (table) => ({
    useridIdx: index('attachments_userid_idx').on(table.userid),
    roteidIdx: index('attachments_roteid_idx').on(table.roteid),
    roteidSortIndexIdx: index('attachments_roteid_sortIndex_idx').on(table.roteid, table.sortIndex),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('set null')
      .onUpdate('cascade'),
    roteidFk: foreignKey({
      columns: [table.roteid],
      foreignColumns: [rotes.id],
    })
      .onDelete('set null')
      .onUpdate('cascade'),
  })
);

// External import identity for idempotent, owner-scoped imports.
// The source key is scoped to the destination owner so the same export can be
// imported safely by different Rote users.
export const noteImportSources = pgTable(
  'note_import_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('ownerId').notNull(),
    roteId: uuid('roteId').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    accountId: varchar('accountId', { length: 100 }).notNull(),
    externalId: varchar('externalId', { length: 100 }).notNull(),
    attachmentMap: jsonb('attachmentMap').notNull().default({}),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index('note_import_sources_owner_idx').on(table.ownerId),
    roteIdUnique: unique('note_import_sources_rote_id_unique').on(table.roteId),
    ownerSourceUnique: unique('note_import_sources_owner_source_unique').on(
      table.ownerId,
      table.provider,
      table.accountId,
      table.externalId
    ),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    roteFk: foreignKey({
      columns: [table.roteId],
      foreignColumns: [rotes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// Rote Link Previews 表
export const roteLinkPreviews = pgTable(
  'rote_link_previews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roteid: uuid('roteid').notNull(),
    url: text('url').notNull(),
    title: text('title'),
    description: text('description'),
    image: text('image'),
    siteName: text('siteName'),
    contentExcerpt: text('contentExcerpt'),
    score: integer('score'),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    roteidIdx: index('rote_link_previews_roteid_idx').on(table.roteid),
    roteidUrlUnique: unique('rote_link_previews_roteid_url_unique').on(table.roteid, table.url),
    roteidFk: foreignKey({
      columns: [table.roteid],
      foreignColumns: [rotes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// Reactions 表
export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 100 }).notNull(),
    userid: uuid('userid'),
    visitorId: varchar('visitorId', { length: 255 }),
    visitorInfo: jsonb('visitorInfo'),
    roteid: uuid('roteid').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueReaction: unique('unique_reaction').on(
      table.userid,
      table.visitorId,
      table.roteid,
      table.type
    ),
    roteidTypeIdx: index('reactions_roteid_type_idx').on(table.roteid, table.type),
    useridIdx: index('reactions_userid_idx').on(table.userid),
    visitorIdIdx: index('reactions_visitorId_idx').on(table.visitorId),
    roteidFk: foreignKey({
      columns: [table.roteid],
      foreignColumns: [rotes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('set null')
      .onUpdate('cascade'),
  })
);

// Settings 表
export const settings = pgTable(
  'settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    group: varchar('group', { length: 100 }).notNull().unique(),
    config: jsonb('config').notNull(),
    isRequired: boolean('isRequired').notNull().default(false),
    isInitialized: boolean('isInitialized').notNull().default(false),
    isSystem: boolean('isSystem').notNull().default(false),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    isRequiredIdx: index('settings_isRequired_idx').on(table.isRequired),
    isInitializedIdx: index('settings_isInitialized_idx').on(table.isInitialized),
    isSystemIdx: index('settings_isSystem_idx').on(table.isSystem),
  })
);

// Rote Changes 表
export const roteChanges = pgTable(
  'rote_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originid: uuid('originid').notNull(),
    roteid: uuid('roteid'),
    action: varchar('action', { length: 50 }).notNull().default('CREATE'),
    userid: uuid('userid').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    originidCreatedAtIdx: index('rote_changes_originid_createdAt_idx').on(
      table.originid,
      table.createdAt
    ),
    originidActionIdx: index('rote_changes_originid_action_idx').on(table.originid, table.action),
    roteidCreatedAtIdx: index('rote_changes_roteid_createdAt_idx').on(
      table.roteid,
      table.createdAt
    ),
    useridIdx: index('rote_changes_userid_idx').on(table.userid),
    roteidActionIdx: index('rote_changes_roteid_action_idx').on(table.roteid, table.action),
    roteidFk: foreignKey({
      columns: [table.roteid],
      foreignColumns: [rotes.id],
    })
      .onDelete('set null')
      .onUpdate('cascade'),
  })
);

// AI document embeddings 表
// Embeddings are stored as text so base migrations keep working on plain Postgres.
// pgvector is used only when the admin explicitly enables vector search.
export const documentEmbeddings = pgTable(
  'document_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('ownerId').notNull(),
    sourceType: varchar('sourceType', { length: 20 }).notNull(),
    sourceId: uuid('sourceId').notNull(),
    chunkIndex: integer('chunkIndex').notNull(),
    contentHash: varchar('contentHash', { length: 64 }).notNull(),
    embeddingModel: text('embeddingModel').notNull(),
    embeddingDimensions: integer('embeddingDimensions').notNull(),
    embedding: text('embedding').notNull(),
    text: text('text').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdIdx: index('document_embeddings_ownerId_idx').on(table.ownerId),
    sourceIdx: index('document_embeddings_source_idx').on(table.sourceType, table.sourceId),
    ownerSourceIdx: index('document_embeddings_owner_source_idx').on(
      table.ownerId,
      table.sourceType
    ),
    modelDimensionsIdx: index('document_embeddings_model_dimensions_idx').on(
      table.embeddingModel,
      table.embeddingDimensions
    ),
    uniqueSourceChunk: unique('document_embeddings_source_chunk_unique').on(
      table.sourceType,
      table.sourceId,
      table.chunkIndex
    ),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// AI embedding jobs 表
export const embeddingJobs = pgTable(
  'embedding_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('ownerId').notNull(),
    sourceType: varchar('sourceType', { length: 20 }).notNull(),
    sourceId: uuid('sourceId').notNull(),
    action: varchar('action', { length: 20 }).notNull().default('upsert'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    error: text('error'),
    lockedAt: timestamp('lockedAt', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('embedding_jobs_status_idx').on(table.status, table.createdAt),
    sourceIdx: index('embedding_jobs_source_idx').on(table.sourceType, table.sourceId),
    ownerIdx: index('embedding_jobs_ownerId_idx').on(table.ownerId),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// User OAuth Bindings 表 - 支持多个 OAuth 绑定
export const userOAuthBindings = pgTable(
  'user_oauth_bindings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userid: uuid('userid').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(), // 'github', 'apple', etc.
    providerId: varchar('providerId', { length: 255 }).notNull(), // OAuth 提供商的用户 ID
    providerUsername: varchar('providerUsername', { length: 255 }), // OAuth 提供商的用户名
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    useridIdx: index('user_oauth_bindings_userid_idx').on(table.userid),
    providerIdx: index('user_oauth_bindings_provider_idx').on(table.provider),
    providerIdIdx: index('user_oauth_bindings_providerId_idx').on(table.providerId),
    // 唯一约束：同一用户不能重复绑定同一个提供商
    uniqueUserProvider: unique('unique_user_provider').on(table.userid, table.provider),
    // 唯一约束：同一提供商下的 providerId 唯一（防止一个 OAuth 账户绑定到多个用户）
    uniqueProviderId: unique('unique_provider_id').on(table.provider, table.providerId),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// User Passkeys 表 - WebAuthn/FIDO2 凭证
export const userPasskeys = pgTable(
  'user_passkeys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userid: uuid('userid').notNull(),
    credentialId: text('credentialId').notNull().unique(),
    publicKey: bytea('publicKey').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: jsonb('transports'), // ["internal", "hybrid", "ble", "nfc", "usb"]
    deviceName: varchar('deviceName', { length: 255 }).default(''),
    deviceType: varchar('deviceType', { length: 50 }).default(''), // "platform" or "cross-platform"
    createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => ({
    useridIdx: index('user_passkeys_userid_idx').on(table.userid),
    credentialIdIdx: index('user_passkeys_credentialId_idx').on(table.credentialId),
    useridFk: foreignKey({
      columns: [table.userid],
      foreignColumns: [users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
  })
);

// 关系定义
export const usersRelations = relations(users, ({ one, many }) => ({
  attachments: many(attachments),
  userreaction: many(reactions),
  rotes: many(rotes),
  articles: many(articles),
  blocksCreated: many(userBlocks, { relationName: 'blocker' }),
  blocksReceived: many(userBlocks, { relationName: 'blocked' }),
  openkey: many(userOpenKeys),
  usersetting: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userid],
  }),
  userswsubscription: many(userSwSubscriptions),
  oauthBindings: many(userOAuthBindings),
  passkeys: many(userPasskeys),
  permissionOverrides: many(userPermissionOverrides),
  billingGrant: one(billingGrants, {
    fields: [users.id],
    references: [billingGrants.userId],
  }),
  documentEmbeddings: many(documentEmbeddings),
  embeddingJobs: many(embeddingJobs),
}));

export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
  blocker: one(users, {
    fields: [userBlocks.blockerId],
    references: [users.id],
    relationName: 'blocker',
  }),
  blocked: one(users, {
    fields: [userBlocks.blockedId],
    references: [users.id],
    relationName: 'blocked',
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userid],
    references: [users.id],
  }),
}));

export const userPermissionOverridesRelations = relations(userPermissionOverrides, ({ one }) => ({
  user: one(users, {
    fields: [userPermissionOverrides.userid],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [userPermissionOverrides.updatedBy],
    references: [users.id],
  }),
}));

export const billingGrantsRelations = relations(billingGrants, ({ one }) => ({
  user: one(users, {
    fields: [billingGrants.userId],
    references: [users.id],
  }),
}));

export const userOpenKeysRelations = relations(userOpenKeys, ({ one, many }) => ({
  user: one(users, {
    fields: [userOpenKeys.userid],
    references: [users.id],
  }),
  usageLogs: many(openKeyUsageLogs),
}));

export const openKeyUsageLogsRelations = relations(openKeyUsageLogs, ({ one }) => ({
  openKey: one(userOpenKeys, {
    fields: [openKeyUsageLogs.openKeyId],
    references: [userOpenKeys.id],
  }),
}));

export const userSwSubscriptionsRelations = relations(userSwSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSwSubscriptions.userid],
    references: [users.id],
  }),
}));

export const rotesRelations = relations(rotes, ({ one, many }) => ({
  author: one(users, {
    fields: [rotes.authorid],
    references: [users.id],
  }),
  article: one(articles, {
    fields: [rotes.articleId],
    references: [articles.id],
  }),
  attachments: many(attachments),
  linkPreviews: many(roteLinkPreviews),
  reactions: many(reactions),
  changes: many(roteChanges),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  rote: one(rotes, {
    fields: [attachments.roteid],
    references: [rotes.id],
  }),
  user: one(users, {
    fields: [attachments.userid],
    references: [users.id],
  }),
}));

export const roteLinkPreviewsRelations = relations(roteLinkPreviews, ({ one }) => ({
  rote: one(rotes, {
    fields: [roteLinkPreviews.roteid],
    references: [rotes.id],
  }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  rote: one(rotes, {
    fields: [reactions.roteid],
    references: [rotes.id],
  }),
  user: one(users, {
    fields: [reactions.userid],
    references: [users.id],
  }),
}));

export const roteChangesRelations = relations(roteChanges, ({ one }) => ({
  rote: one(rotes, {
    fields: [roteChanges.roteid],
    references: [rotes.id],
  }),
}));

export const documentEmbeddingsRelations = relations(documentEmbeddings, ({ one }) => ({
  owner: one(users, {
    fields: [documentEmbeddings.ownerId],
    references: [users.id],
  }),
}));

export const embeddingJobsRelations = relations(embeddingJobs, ({ one }) => ({
  owner: one(users, {
    fields: [embeddingJobs.ownerId],
    references: [users.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
  rotes: many(rotes),
}));

export const userOAuthBindingsRelations = relations(userOAuthBindings, ({ one }) => ({
  user: one(users, {
    fields: [userOAuthBindings.userid],
    references: [users.id],
  }),
}));

export const userPasskeysRelations = relations(userPasskeys, ({ one }) => ({
  user: one(users, {
    fields: [userPasskeys.userid],
    references: [users.id],
  }),
}));

export const aiTokenUsageLogsRelations = relations(aiTokenUsageLogs, ({ one }) => ({
  user: one(users, {
    fields: [aiTokenUsageLogs.userid],
    references: [users.id],
  }),
}));

// 导出类型
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserBlock = typeof userBlocks.$inferSelect;
export type NewUserBlock = typeof userBlocks.$inferInsert;
export type UserSetting = typeof userSettings.$inferSelect;
export type NewUserSetting = typeof userSettings.$inferInsert;
export type UserOpenKey = typeof userOpenKeys.$inferSelect;
export type NewUserOpenKey = typeof userOpenKeys.$inferInsert;
export type UserSwSubscription = typeof userSwSubscriptions.$inferSelect;
export type NewUserSwSubscription = typeof userSwSubscriptions.$inferInsert;
export type Rote = typeof rotes.$inferSelect;
export type NewRote = typeof rotes.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type NoteImportSource = typeof noteImportSources.$inferSelect;
export type NewNoteImportSource = typeof noteImportSources.$inferInsert;
export type RoteLinkPreview = typeof roteLinkPreviews.$inferSelect;
export type NewRoteLinkPreview = typeof roteLinkPreviews.$inferInsert;
export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type RoteChange = typeof roteChanges.$inferSelect;
export type NewRoteChange = typeof roteChanges.$inferInsert;
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
export type NewDocumentEmbedding = typeof documentEmbeddings.$inferInsert;
export type EmbeddingJob = typeof embeddingJobs.$inferSelect;
export type NewEmbeddingJob = typeof embeddingJobs.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type UserOAuthBinding = typeof userOAuthBindings.$inferSelect;
export type NewUserOAuthBinding = typeof userOAuthBindings.$inferInsert;
export type OpenKeyUsageLog = typeof openKeyUsageLogs.$inferSelect;
export type NewOpenKeyUsageLog = typeof openKeyUsageLogs.$inferInsert;
export type UserPasskey = typeof userPasskeys.$inferSelect;
export type NewUserPasskey = typeof userPasskeys.$inferInsert;
export type AiTokenUsageLog = typeof aiTokenUsageLogs.$inferSelect;
export type NewAiTokenUsageLog = typeof aiTokenUsageLogs.$inferInsert;
export type BillingGrant = typeof billingGrants.$inferSelect;
export type NewBillingGrant = typeof billingGrants.$inferInsert;
export type BillingInboundDelivery = typeof billingInboundDeliveries.$inferSelect;
export type NewBillingInboundDelivery = typeof billingInboundDeliveries.$inferInsert;
