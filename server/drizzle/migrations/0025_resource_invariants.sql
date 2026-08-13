CREATE TABLE "resource_management_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"cleanup_fuse_tripped" boolean DEFAULT false NOT NULL,
	"reconciliation_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"reconciliation_started_at" timestamp (6) with time zone,
	"reconciliation_completed_at" timestamp (6) with time zone,
	"reconciliation_last_error" text,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_upload_reservations" ADD COLUMN "credential_expires_at" timestamp (6) with time zone;--> statement-breakpoint
CREATE INDEX "resource_cleanup_outbox_pending_attempt_idx" ON "resource_cleanup_outbox" USING btree ("completed_at","next_attempt_at");--> statement-breakpoint
CREATE INDEX "resource_upload_reservations_status_expiry_idx" ON "resource_upload_reservations" USING btree ("status","expires_at");