CREATE TABLE IF NOT EXISTS "user_oauth_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userid" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"providerId" varchar(255) NOT NULL,
	"providerUsername" varchar(255),
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_provider" UNIQUE("userid","provider"),
	CONSTRAINT "unique_provider_id" UNIQUE("provider","providerId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_oauth_bindings" ADD CONSTRAINT "user_oauth_bindings_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_oauth_bindings_userid_idx" ON "user_oauth_bindings" USING btree ("userid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_oauth_bindings_provider_idx" ON "user_oauth_bindings" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_oauth_bindings_providerId_idx" ON "user_oauth_bindings" USING btree ("providerId");