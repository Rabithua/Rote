CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"authorId" uuid NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rotes" ADD COLUMN "articleId" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_authorId_users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_authorId_idx" ON "articles" USING btree ("authorId");--> statement-breakpoint
ALTER TABLE "rotes" ADD CONSTRAINT "rotes_articleId_articles_id_fk" FOREIGN KEY ("articleId") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "rotes_articleId_idx" ON "rotes" USING btree ("articleId");