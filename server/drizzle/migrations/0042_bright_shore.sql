-- Restore updatedAt defaults on hand-created production tables. The original
-- tables predate the drizzle baseline and shipped createdAt DEFAULT now() but
-- no updatedAt default, while the drizzle schema declares .defaultNow() for
-- both. INSERT paths that rely on the schema default (e.g. OAuth account
-- registration) fail with 23502 on databases migrated from that old layout.
-- SET DEFAULT is idempotent, so databases built from migration 0000 converge
-- to the identical state.
ALTER TABLE "attachments" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "reactions" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "rotes" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_open_keys" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_sw_subscriptions" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updatedAt" SET DEFAULT now();
