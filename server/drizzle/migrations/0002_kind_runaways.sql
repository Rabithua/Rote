-- ============================================
-- 迁移 0002: 添加 OAuth 支持和修复 archived 列
-- ============================================

-- 1. 修复 rotes.archived 列：设置为 NOT NULL
--    先处理可能存在的 NULL 值，然后设置默认值和 NOT NULL 约束
UPDATE "rotes" SET "archived" = false WHERE "archived" IS NULL;--> statement-breakpoint
ALTER TABLE "rotes" ALTER COLUMN "archived" SET DEFAULT false;--> statement-breakpoint
-- 检查列是否已经是 NOT NULL，如果不是则设置（幂等操作）
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'rotes' 
    AND column_name = 'archived' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "rotes" ALTER COLUMN "archived" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint

-- 2. 修改 users 表：passwordhash 和 salt 改为可空（支持 OAuth 用户）
--    这些操作是幂等的，可以安全地重复执行
DO $$ 
BEGIN
  -- 检查 passwordhash 列是否仍然是 NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'users' 
    AND column_name = 'passwordhash' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "passwordhash" DROP NOT NULL;
  END IF;
  
  -- 检查 salt 列是否仍然是 NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'users' 
    AND column_name = 'salt' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "salt" DROP NOT NULL;
  END IF;
END $$;--> statement-breakpoint

-- 3. 添加 OAuth 相关字段
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authProvider" varchar(50) DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authProviderId" varchar(255);--> statement-breakpoint

-- 4. 确保所有现有用户都设置为本地认证（幂等操作）
UPDATE "users" SET "authProvider" = 'local' WHERE "authProvider" IS NULL;--> statement-breakpoint

-- 5. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS "users_authProvider_idx" ON "users" USING btree ("authProvider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_authProviderId_idx" ON "users" USING btree ("authProviderId");--> statement-breakpoint

-- 6. 添加唯一约束（如果不存在）
--    注意：PostgreSQL 的唯一约束允许多个 NULL 值，所以本地用户（authProviderId 为 NULL）不会冲突
--    但对于 OAuth 用户，同一 provider 下的 providerId 必须唯一
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND t.relname = 'users'
    AND c.conname = 'unique_auth_provider'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "unique_auth_provider" UNIQUE("authProvider","authProviderId");
  END IF;
END $$;
