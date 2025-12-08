DROP INDEX IF EXISTS "users_authProvider_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "authProvider";