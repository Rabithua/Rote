ALTER TABLE "resource_upload_reservations" ADD COLUMN "finalizing_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_upload_reservations" ADD COLUMN "finalizing_lease_token" uuid;--> statement-breakpoint
ALTER TABLE "resource_upload_reservations" ADD COLUMN "finalizing_lease_expires_at" timestamp (6) with time zone;