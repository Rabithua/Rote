CREATE TABLE "oauth_merge_authorizations" (
	"target_user_id" uuid NOT NULL,
	"source_user_id" uuid NOT NULL,
	"source_binding_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"completed_at" timestamp (6) with time zone,
	"result" jsonb,
	CONSTRAINT "oauth_merge_authorizations_identity_pk" PRIMARY KEY("target_user_id","source_user_id","provider","provider_id"),
	CONSTRAINT "oauth_merge_authorizations_result_state" CHECK (("oauth_merge_authorizations"."completed_at" IS NULL AND "oauth_merge_authorizations"."result" IS NULL) OR ("oauth_merge_authorizations"."completed_at" IS NOT NULL AND "oauth_merge_authorizations"."result" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "oauth_merge_authorizations" ADD CONSTRAINT "oauth_merge_authorizations_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "oauth_merge_authorizations_source_binding_idx" ON "oauth_merge_authorizations" USING btree ("source_binding_id");--> statement-breakpoint
CREATE INDEX "oauth_merge_authorizations_expires_idx" ON "oauth_merge_authorizations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_merge_authorizations_completed_idx" ON "oauth_merge_authorizations" USING btree ("completed_at");