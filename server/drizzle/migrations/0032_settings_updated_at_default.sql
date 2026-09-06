-- The initial Drizzle baseline retained existing settings tables. Prisma-era
-- updatedAt values were supplied by the client, so those tables have no SQL
-- default. PostgreSQL checks NOT NULL before resolving an upsert conflict.
-- Align the retained table with schema.ts without rewriting existing settings.
ALTER TABLE "settings" ALTER COLUMN "updatedAt" SET DEFAULT now();
