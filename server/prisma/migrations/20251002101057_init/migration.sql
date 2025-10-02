-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "passwordhash" BYTEA NOT NULL,
    "salt" BYTEA NOT NULL,
    "nickname" VARCHAR(255),
    "description" TEXT,
    "cover" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sw_subscriptions" (
    "id" UUID NOT NULL,
    "userid" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "note" TEXT DEFAULT '',
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "expirationTime" TEXT,
    "keys" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_sw_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "userid" UUID NOT NULL,
    "darkmode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_open_keys" (
    "id" UUID NOT NULL,
    "userid" UUID NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY['SENDROTE']::TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_open_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotes" (
    "id" UUID NOT NULL,
    "title" TEXT DEFAULT '',
    "type" VARCHAR(100) DEFAULT 'Rote',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content" TEXT NOT NULL,
    "state" VARCHAR(50) NOT NULL DEFAULT 'private',
    "archived" BOOLEAN DEFAULT false,
    "authorid" UUID NOT NULL,
    "pin" BOOLEAN NOT NULL DEFAULT false,
    "editor" VARCHAR(100) DEFAULT 'normal',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "compressUrl" TEXT DEFAULT '',
    "userid" UUID,
    "roteid" UUID,
    "storage" VARCHAR(100) NOT NULL,
    "details" JSONB NOT NULL,
    "sortIndex" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "userid" UUID,
    "visitorId" VARCHAR(255),
    "visitorInfo" JSONB,
    "roteid" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" VARCHAR(255) NOT NULL,
    "webClientSetting" JSONB NOT NULL,
    "storage" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_sw_subscriptions_endpoint_key" ON "user_sw_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userid_key" ON "user_settings"("userid");

-- CreateIndex
CREATE INDEX "rotes_authorid_state_idx" ON "rotes"("authorid", "state");

-- CreateIndex
CREATE INDEX "rotes_authorid_archived_idx" ON "rotes"("authorid", "archived");

-- CreateIndex
CREATE INDEX "rotes_authorid_createdAt_idx" ON "rotes"("authorid", "createdAt");

-- CreateIndex
CREATE INDEX "rotes_tags_idx" ON "rotes" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "attachments_userid_idx" ON "attachments"("userid");

-- CreateIndex
CREATE INDEX "attachments_roteid_idx" ON "attachments"("roteid");

-- CreateIndex
CREATE INDEX "attachments_roteid_sortIndex_idx" ON "attachments"("roteid", "sortIndex");

-- CreateIndex
CREATE INDEX "reactions_roteid_type_idx" ON "reactions"("roteid", "type");

-- CreateIndex
CREATE INDEX "reactions_userid_idx" ON "reactions"("userid");

-- CreateIndex
CREATE INDEX "reactions_visitorId_idx" ON "reactions"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_userid_visitorId_roteid_type_key" ON "reactions"("userid", "visitorId", "roteid", "type");

-- AddForeignKey
ALTER TABLE "user_sw_subscriptions" ADD CONSTRAINT "user_sw_subscriptions_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_open_keys" ADD CONSTRAINT "user_open_keys_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotes" ADD CONSTRAINT "rotes_authorid_fkey" FOREIGN KEY ("authorid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_roteid_fkey" FOREIGN KEY ("roteid") REFERENCES "rotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_roteid_fkey" FOREIGN KEY ("roteid") REFERENCES "rotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
