CREATE TABLE "rote_link_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roteid" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"image" text,
	"siteName" text,
	"contentExcerpt" text,
	"score" integer,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rote_link_previews_roteid_url_unique" UNIQUE("roteid","url")
);
--> statement-breakpoint
ALTER TABLE "rote_link_previews" ADD CONSTRAINT "rote_link_previews_roteid_rotes_id_fk" FOREIGN KEY ("roteid") REFERENCES "public"."rotes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "rote_link_previews_roteid_idx" ON "rote_link_previews" USING btree ("roteid");