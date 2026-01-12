ALTER TABLE "rotes" ADD COLUMN "articleId" uuid;--> statement-breakpoint
ALTER TABLE "rotes" ADD CONSTRAINT "rotes_articleId_articles_id_fk" FOREIGN KEY ("articleId") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "rotes_articleId_idx" ON "rotes" USING btree ("articleId");--> statement-breakpoint

UPDATE "rotes" r
SET "articleId" = sub."articleId"
FROM (
	SELECT DISTINCT ON ("noteId") "noteId", "articleId"
	FROM "note_article_refs"
	ORDER BY "noteId", "createdAt" ASC
) sub
WHERE r."id" = sub."noteId" AND r."articleId" IS NULL;