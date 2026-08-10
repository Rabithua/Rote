ALTER TABLE "billing_inbound_deliveries" ADD COLUMN "request_target" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "billing_inbound_deliveries" ALTER COLUMN "request_target" DROP DEFAULT;
