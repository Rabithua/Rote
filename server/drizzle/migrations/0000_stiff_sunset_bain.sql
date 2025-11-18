-- 启用 pgcrypto 扩展（gen_random_uuid() 函数需要此扩展）
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"compressUrl" text DEFAULT '',
	"userid" uuid,
	"roteid" uuid,
	"storage" varchar(100) NOT NULL,
	"details" jsonb NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"sortIndex" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(100) NOT NULL,
	"userid" uuid,
	"visitorId" varchar(255),
	"visitorInfo" jsonb,
	"roteid" uuid NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_reaction" UNIQUE("userid","visitorId","roteid","type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rote_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"originid" uuid NOT NULL,
	"roteid" uuid,
	"action" varchar(50) DEFAULT 'CREATE' NOT NULL,
	"userid" uuid NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT '',
	"type" varchar(100) DEFAULT 'Rote',
	"tags" text[] DEFAULT '{}' NOT NULL,
	"content" text NOT NULL,
	"state" varchar(50) DEFAULT 'private' NOT NULL,
	"archived" boolean DEFAULT false,
	"authorid" uuid NOT NULL,
	"pin" boolean DEFAULT false NOT NULL,
	"editor" varchar(100) DEFAULT 'normal',
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group" varchar(100) NOT NULL,
	"config" jsonb NOT NULL,
	"isRequired" boolean DEFAULT false NOT NULL,
	"isInitialized" boolean DEFAULT false NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_group_unique" UNIQUE("group")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_open_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userid" uuid NOT NULL,
	"permissions" text[] DEFAULT '{"SENDROTE"}' NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userid" uuid NOT NULL,
	"darkmode" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_userid_unique" UNIQUE("userid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sw_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userid" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"note" text DEFAULT '',
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"expirationTime" text,
	"keys" jsonb NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sw_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"passwordhash" "bytea" NOT NULL,
	"salt" "bytea" NOT NULL,
	"nickname" varchar(255),
	"description" text,
	"cover" text,
	"avatar" text,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_roteid_rotes_id_fk" FOREIGN KEY ("roteid") REFERENCES "public"."rotes"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reactions" ADD CONSTRAINT "reactions_roteid_rotes_id_fk" FOREIGN KEY ("roteid") REFERENCES "public"."rotes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rote_changes" ADD CONSTRAINT "rote_changes_roteid_rotes_id_fk" FOREIGN KEY ("roteid") REFERENCES "public"."rotes"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rotes" ADD CONSTRAINT "rotes_authorid_users_id_fk" FOREIGN KEY ("authorid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_open_keys" ADD CONSTRAINT "user_open_keys_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sw_subscriptions" ADD CONSTRAINT "user_sw_subscriptions_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_userid_idx" ON "attachments" USING btree ("userid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_roteid_idx" ON "attachments" USING btree ("roteid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_roteid_sortIndex_idx" ON "attachments" USING btree ("roteid","sortIndex");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_roteid_type_idx" ON "reactions" USING btree ("roteid","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_userid_idx" ON "reactions" USING btree ("userid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_visitorId_idx" ON "reactions" USING btree ("visitorId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rote_changes_originid_createdAt_idx" ON "rote_changes" USING btree ("originid","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rote_changes_originid_action_idx" ON "rote_changes" USING btree ("originid","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rote_changes_roteid_createdAt_idx" ON "rote_changes" USING btree ("roteid","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rote_changes_userid_idx" ON "rote_changes" USING btree ("userid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rote_changes_roteid_action_idx" ON "rote_changes" USING btree ("roteid","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rotes_authorid_state_idx" ON "rotes" USING btree ("authorid","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rotes_authorid_archived_idx" ON "rotes" USING btree ("authorid","archived");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rotes_authorid_created_at_idx" ON "rotes" USING btree ("authorid","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rotes_tags_idx" ON "rotes" USING gin ("tags");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settings_isRequired_idx" ON "settings" USING btree ("isRequired");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settings_isInitialized_idx" ON "settings" USING btree ("isInitialized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settings_isSystem_idx" ON "settings" USING btree ("isSystem");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_open_keys_userid_idx" ON "user_open_keys" USING btree ("userid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_settings_userid_idx" ON "user_settings" USING btree ("userid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sw_subscriptions_userid_idx" ON "user_sw_subscriptions" USING btree ("userid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sw_subscriptions_endpoint_idx" ON "user_sw_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");