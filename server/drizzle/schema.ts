import { relations } from 'drizzle-orm';
import {
  boolean,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
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

// 关系定义
export const usersRelations = relations(users, ({ one, many }) => ({
  attachments: many(attachments),
  userreaction: many(reactions),
  rotes: many(rotes),
  articles: many(articles),
  openkey: many(userOpenKeys),
  usersetting: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userid],
  }),
  userswsubscription: many(userSwSubscriptions),
  oauthBindings: many(userOAuthBindings),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userid],
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

// 导出类型
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
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
export type RoteLinkPreview = typeof roteLinkPreviews.$inferSelect;
export type NewRoteLinkPreview = typeof roteLinkPreviews.$inferInsert;
export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type RoteChange = typeof roteChanges.$inferSelect;
export type NewRoteChange = typeof roteChanges.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type UserOAuthBinding = typeof userOAuthBindings.$inferSelect;
export type NewUserOAuthBinding = typeof userOAuthBindings.$inferInsert;
export type OpenKeyUsageLog = typeof openKeyUsageLogs.$inferSelect;
export type NewOpenKeyUsageLog = typeof openKeyUsageLogs.$inferInsert;
