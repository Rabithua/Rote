CREATE TABLE "embedding_source_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sourceType" text NOT NULL,
	"sourceId" uuid NOT NULL,
	"ownerId" uuid NOT NULL,
	"action" text NOT NULL,
	"generationId" uuid,
	"rebuilding" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "embedding_source_events_pending_idx" ON "embedding_source_events" USING btree ("createdAt","id");
--> statement-breakpoint
-- Commit content changes and their indexing events together. No provider calls,
-- pgvector dependency, or index-state locks are taken by these triggers.
CREATE FUNCTION record_embedding_source_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source jsonb;
  active_generation uuid;
  rebuilding boolean;
BEGIN
  source := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  SELECT "generationId", status IN ('rebuilding', 'failed')
    INTO active_generation, rebuilding FROM embedding_index_state WHERE id = 1;
  INSERT INTO embedding_source_events ("sourceType", "sourceId", "ownerId", action, "generationId", rebuilding)
    VALUES (TG_ARGV[0], (source->>'id')::uuid, (source->>TG_ARGV[1])::uuid,
      CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'upsert' END,
      active_generation, COALESCE(rebuilding, false));
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER rote_embedding_event AFTER INSERT OR UPDATE OR DELETE ON rotes
FOR EACH ROW EXECUTE FUNCTION record_embedding_source_event('rote', 'authorid');
--> statement-breakpoint
CREATE TRIGGER article_embedding_event AFTER INSERT OR UPDATE OR DELETE ON articles
FOR EACH ROW EXECUTE FUNCTION record_embedding_source_event('article', 'authorId');

--> statement-breakpoint
ALTER TABLE "embedding_index_state" ADD COLUMN "errorDetails" jsonb;