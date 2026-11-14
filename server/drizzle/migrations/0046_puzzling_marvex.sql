ALTER TABLE "gift_codes" DROP CONSTRAINT "gift_codes_userid_users_id_fk";
--> statement-breakpoint
DROP INDEX "gift_codes_campaign_status_idx";--> statement-breakpoint
ALTER TABLE "gift_codes" ALTER COLUMN "userid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "gift_codes" ALTER COLUMN "allocatedAt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_codes_campaign_idx" ON "gift_codes" USING btree ("campaignId");--> statement-breakpoint
ALTER TABLE "gift_codes" DROP COLUMN "status";