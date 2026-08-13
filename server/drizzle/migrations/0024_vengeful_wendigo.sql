CREATE TABLE "resource_cleanup_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_identity" varchar(255) NOT NULL,
	"object_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp (6) with time zone,
	"last_error" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_cleanup_outbox_identity_key_unique" UNIQUE("storage_identity","object_key")
);
--> statement-breakpoint
CREATE TABLE "resource_storage_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"used_bytes" bigint DEFAULT 0 NOT NULL,
	"reserved_bytes" bigint DEFAULT 0 NOT NULL,
	"reconciled_at" timestamp (6) with time zone,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_storage_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"storage_identity" varchar(255) NOT NULL,
	"object_key" text NOT NULL,
	"role" varchar(32) NOT NULL,
	"actual_bytes" bigint NOT NULL,
	"billable" boolean NOT NULL,
	"reference_count" integer DEFAULT 1 NOT NULL,
	"state" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_storage_objects_identity_key_unique" UNIQUE("storage_identity","object_key")
);
--> statement-breakpoint
CREATE TABLE "resource_upload_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"grant_revision" bigint,
	"grant_pro_derived" boolean DEFAULT false NOT NULL,
	"grant_entitlement_expires_at" timestamp (6) with time zone,
	"manifest" jsonb NOT NULL,
	"reserved_bytes" bigint NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"result" jsonb,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp (6) with time zone
);
--> statement-breakpoint
ALTER TABLE "billing_grants" ADD COLUMN "benefits" jsonb;--> statement-breakpoint
ALTER TABLE "resource_storage_accounts" ADD CONSTRAINT "resource_storage_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "resource_storage_objects" ADD CONSTRAINT "resource_storage_objects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_upload_reservations" ADD CONSTRAINT "resource_upload_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "resource_storage_objects_owner_idx" ON "resource_storage_objects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "resource_upload_reservations_user_status_idx" ON "resource_upload_reservations" USING btree ("user_id","status");