CREATE TABLE "gift_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"title" varchar(120),
	"description" text,
	"createdBy" uuid,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_campaigns_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "gift_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaignId" uuid NOT NULL,
	"code" text NOT NULL,
	"expiresAt" timestamp (6) with time zone NOT NULL,
	"userid" uuid,
	"allocatedAt" timestamp (6) with time zone,
	"shownAt" timestamp (6) with time zone,
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "gift_campaigns" ADD CONSTRAINT "gift_campaigns_created_by_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_campaign_id_gift_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."gift_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_campaigns_status_idx" ON "gift_campaigns" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "gift_codes_userid_idx" ON "gift_codes" USING btree ("userid");--> statement-breakpoint
CREATE INDEX "gift_codes_campaign_status_idx" ON "gift_codes" USING btree ("campaignId","status");