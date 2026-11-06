CREATE TABLE "oauth_registration_authorizations" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"provider_username" varchar(255),
	"suggested_username" varchar(20) NOT NULL,
	"avatar" text,
	"frontend_base_url" text NOT NULL,
	"redirect_url" text NOT NULL,
	"ios_login" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"consumed_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "oauth_registration_authorizations_expires_idx" ON "oauth_registration_authorizations" USING btree ("expires_at");