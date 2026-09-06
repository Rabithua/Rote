-- Embedding text uses note title/tags/content or article content. Ownership is
-- also an indexing input; visibility and timestamps are read from live sources.
-- Keep insert/delete events transactional, without re-embedding attachment edits.
DROP TRIGGER rote_embedding_event ON rotes;
--> statement-breakpoint
CREATE TRIGGER rote_embedding_event AFTER INSERT OR DELETE ON rotes
FOR EACH ROW EXECUTE FUNCTION record_embedding_source_event('rote', 'authorid');
--> statement-breakpoint
CREATE TRIGGER rote_embedding_update_event AFTER UPDATE OF title, tags, content, authorid ON rotes
FOR EACH ROW WHEN (
  (OLD.title, OLD.tags, OLD.content, OLD.authorid)
  IS DISTINCT FROM (NEW.title, NEW.tags, NEW.content, NEW.authorid)
) EXECUTE FUNCTION record_embedding_source_event('rote', 'authorid');
--> statement-breakpoint
DROP TRIGGER article_embedding_event ON articles;
--> statement-breakpoint
CREATE TRIGGER article_embedding_event AFTER INSERT OR DELETE ON articles
FOR EACH ROW EXECUTE FUNCTION record_embedding_source_event('article', 'authorId');
--> statement-breakpoint
CREATE TRIGGER article_embedding_update_event AFTER UPDATE OF content, "authorId" ON articles
FOR EACH ROW WHEN (
  (OLD.content, OLD."authorId") IS DISTINCT FROM (NEW.content, NEW."authorId")
) EXECUTE FUNCTION record_embedding_source_event('article', 'authorId');
