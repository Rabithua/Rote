CREATE TABLE "push_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdBy" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"route" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"sentAt" timestamp (6) with time zone,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_created_by_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_campaigns_status_idx" ON "push_campaigns" USING btree ("status","createdAt");
