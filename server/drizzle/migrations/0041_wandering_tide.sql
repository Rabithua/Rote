-- Converge databases where migration 0040 did not fully apply (deployment
-- interruptions before db-migrate completed left users.email NOT NULL while
-- the OAuth registration flow inserts NULL emails). Both statements are
-- idempotent: DROP NOT NULL succeeds on an already-nullable column and
-- IF NOT EXISTS skips an existing index, so rerunning 0040-era state is safe.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_registration_authorizations_expires_idx" ON "oauth_registration_authorizations" USING btree ("expires_at");
