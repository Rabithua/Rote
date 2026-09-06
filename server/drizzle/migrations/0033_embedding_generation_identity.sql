ALTER TABLE "embedding_index_state" ADD COLUMN "generationFingerprint" text;
--> statement-breakpoint
ALTER TABLE "embedding_index_state" ADD COLUMN "generationDimensions" integer;
--> statement-breakpoint
ALTER TABLE "embedding_index_state" ADD COLUMN "generationReusable" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Only these states establish that the saved configuration belongs to this
-- generation. An invalidated or legacy index must never be inferred from it.
UPDATE "embedding_index_state"
SET "generationFingerprint" = fingerprint,
    "generationDimensions" = dimensions,
    "generationReusable" = status = 'ready'
WHERE "generationId" IS NOT NULL AND fingerprint IS NOT NULL
  AND status IN ('ready', 'rebuilding', 'failed');
