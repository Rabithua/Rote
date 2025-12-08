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
    // OAuth 认证提供商（'local' | 'github' | ...）
    authProvider: varchar('authProvider', { length: 50 }).notNull().default('local'),
    // OAuth 提供商的用户 ID
    authProviderId: varchar('authProviderId', { length: 255 }),
    // OAuth 提供商的用户名（例如 GitHub 用户名）
    authProviderUsername: varchar('authProviderUsername', { length: 255 }),
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
    authProviderIdx: index('users_authProvider_idx').on(table.authProvider),
    authProviderIdIdx: index('users_authProviderId_idx').on(table.authProviderId),
    // 唯一约束：同一提供商下的 providerId 唯一（仅当 authProviderId 不为 null 时）
    // 注意：Drizzle 不支持部分唯一索引，需要在应用层处理唯一性
    uniqueAuthProvider: unique('unique_auth_provider').on(table.authProvider, table.authProviderId),
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

// 定义关系
export const usersRelations = relations(users, ({ one, many }) => ({
  attachments: many(attachments),
  userreaction: many(reactions),
  rotes: many(rotes),
  openkey: many(userOpenKeys),
  usersetting: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userid],
  }),
  userswsubscription: many(userSwSubscriptions),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userid],
    references: [users.id],
  }),
}));

export const userOpenKeysRelations = relations(userOpenKeys, ({ one }) => ({
  user: one(users, {
    fields: [userOpenKeys.userid],
    references: [users.id],
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
  attachments: many(attachments),
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
export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type RoteChange = typeof roteChanges.$inferSelect;
export type NewRoteChange = typeof roteChanges.$inferInsert;
