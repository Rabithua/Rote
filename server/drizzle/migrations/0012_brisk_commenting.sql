CREATE TABLE "rote_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roteid" uuid NOT NULL,
	"userid" uuid NOT NULL,
	"parentId" uuid,
	"content" text NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rote_comments" ADD CONSTRAINT "rote_comments_roteid_rotes_id_fk" FOREIGN KEY ("roteid") REFERENCES "public"."rotes"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "rote_comments" ADD CONSTRAINT "rote_comments_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "rote_comments" ADD CONSTRAINT "rote_comments_parentId_rote_comments_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."rote_comments"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "rote_comments_roteid_idx" ON "rote_comments" USING btree ("roteid");
--> statement-breakpoint
CREATE INDEX "rote_comments_parentId_idx" ON "rote_comments" USING btree ("parentId");
--> statement-breakpoint
CREATE INDEX "rote_comments_userid_idx" ON "rote_comments" USING btree ("userid");
--> statement-breakpoint
CREATE INDEX "rote_comments_roteid_createdAt_idx" ON "rote_comments" USING btree ("roteid","createdAt");
