ALTER TABLE "rote_link_previews" ADD COLUMN "status" varchar(20) DEFAULT 'success' NOT NULL;--> statement-breakpoint
ALTER TABLE "rote_link_previews" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "rote_link_previews" ADD COLUMN "parserVersion" varchar(50);--> statement-breakpoint
ALTER TABLE "rote_link_previews" ADD COLUMN "fetchedAt" timestamp (6) with time zone;