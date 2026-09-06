CREATE TABLE "embedding_index_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"fingerprint" text,
	"dimensions" integer,
	"generationId" uuid,
	"status" text DEFAULT 'needs_validation' NOT NULL,
	"scanSource" text DEFAULT 'rote' NOT NULL,
	"scanCursor" uuid,
	"scanComplete" boolean DEFAULT false NOT NULL,
	"errorCode" text,
	"validatedAt" timestamp (6) with time zone,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embedding_index_state_singleton" CHECK ("embedding_index_state"."id" = 1),
	CONSTRAINT "embedding_index_dimensions_range" CHECK ("embedding_index_state"."dimensions" BETWEEN 1 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "document_embeddings" DROP CONSTRAINT "document_embeddings_source_chunk_unique";--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD COLUMN "generationId" uuid;--> statement-breakpoint
ALTER TABLE "embedding_jobs" ADD COLUMN "generationId" uuid;--> statement-breakpoint
ALTER TABLE "embedding_jobs" ADD COLUMN "leaseToken" uuid;--> statement-breakpoint
ALTER TABLE "embedding_jobs" ADD COLUMN "leaseExpiresAt" timestamp (6) with time zone;--> statement-breakpoint
ALTER TABLE "embedding_jobs" ADD COLUMN "nextAttemptAt" timestamp (6) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "embedding_jobs_pending_source_idx" ON "embedding_jobs" USING btree ("generationId","sourceType","sourceId") WHERE "embedding_jobs"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "embedding_jobs_running_source_idx" ON "embedding_jobs" USING btree ("generationId","sourceType","sourceId") WHERE "embedding_jobs"."status" = 'running';--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_generation_source_chunk_unique" UNIQUE("generationId","sourceType","sourceId","chunkIndex");
--> statement-breakpoint
INSERT INTO "embedding_index_state" ("id") VALUES (1);
--> statement-breakpoint
UPDATE "embedding_jobs" SET "status" = 'cancelled', "lockedAt" = NULL
WHERE "status" IN ('pending', 'running');
--> statement-breakpoint
UPDATE "settings" SET "config" =
  jsonb_set(
    jsonb_set("config", '{embedding}',
      (COALESCE("config"->'embedding', '{}'::jsonb) - 'dimensions') ||
      jsonb_build_object('output', CASE
        WHEN "config"->'embedding' ? 'dimensions' THEN jsonb_build_object('mode', 'dimensions', 'dimensions', "config"->'embedding'->'dimensions')
        ELSE '{"mode":"native"}'::jsonb END)),
    '{schemaVersion}', '2'::jsonb) || '{"revision":0}'::jsonb
WHERE "group" = 'ai';
