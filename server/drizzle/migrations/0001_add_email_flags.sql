--> statement-breakpoint
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "emailVerified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_settings"
ADD COLUMN IF NOT EXISTS "allowExplore" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- 迁移旧数据：将现有用户视为已验证邮箱
UPDATE "users" SET "emailVerified" = true;
