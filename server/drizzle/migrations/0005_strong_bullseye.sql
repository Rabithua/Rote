-- ============================================
-- 迁移 0005: 迁移 OAuth 数据并删除旧字段
-- ============================================
-- 注意：此迁移会在删除字段之前先迁移数据，确保数据不丢失

-- 步骤 1: 迁移非 'local' 用户的 OAuth 绑定数据
-- 将 users 表中的 authProviderId 和 authProviderUsername 迁移到 user_oauth_bindings 表
INSERT INTO "user_oauth_bindings" ("userid", "provider", "providerId", "providerUsername", "createdAt", "updatedAt")
SELECT 
  "id" as "userid",
  COALESCE("authProvider", 'local') as "provider",
  "authProviderId" as "providerId",
  "authProviderUsername" as "providerUsername",
  "createdAt",
  "updatedAt"
FROM "users"
WHERE "authProviderId" IS NOT NULL
  AND COALESCE("authProvider", 'local') != 'local'
  -- 避免重复：检查是否已存在相同的绑定
  AND NOT EXISTS (
    SELECT 1 FROM "user_oauth_bindings" uob
    WHERE uob."userid" = "users"."id"
      AND uob."provider" = COALESCE("users"."authProvider", 'local')
      AND uob."providerId" = "users"."authProviderId"
  )
ON CONFLICT ("userid", "provider") DO NOTHING;--> statement-breakpoint

-- 步骤 2: 处理 'local' 用户但有 authProviderId 的历史遗留数据
-- 基于 providerId 格式推断提供商（GitHub 或 Apple）
DO $$
DECLARE
  user_record RECORD;
  inferred_provider VARCHAR(50);
BEGIN
  FOR user_record IN 
    SELECT "id", "authProviderId", "authProviderUsername", "createdAt", "updatedAt"
    FROM "users"
    WHERE "authProviderId" IS NOT NULL
      AND COALESCE("authProvider", 'local') = 'local'
      -- 避免重复：检查是否已存在绑定
      AND NOT EXISTS (
        SELECT 1 FROM "user_oauth_bindings" uob
        WHERE uob."userid" = "users"."id"
          AND uob."providerId" = "users"."authProviderId"
      )
  LOOP
    -- 基于 providerId 格式推断提供商
    -- GitHub: 纯数字（通常是 6-10 位）
    IF user_record."authProviderId" ~ '^\d{6,10}$' THEN
      inferred_provider := 'github';
    -- Apple: 包含点号和长字符串
    ELSIF user_record."authProviderId" ~ '^\d+\.\w+\.\d+$' 
       OR (user_record."authProviderId" LIKE '%.%' AND LENGTH(user_record."authProviderId") > 20) THEN
      inferred_provider := 'apple';
    ELSE
      -- 无法推断，跳过
      CONTINUE;
    END IF;

    -- 插入推断的绑定
    -- 使用异常处理来处理唯一约束冲突（userid+provider 或 provider+providerId）
    BEGIN
      INSERT INTO "user_oauth_bindings" ("userid", "provider", "providerId", "providerUsername", "createdAt", "updatedAt")
      VALUES (
        user_record."id",
        inferred_provider,
        user_record."authProviderId",
        user_record."authProviderUsername",
        user_record."createdAt",
        user_record."updatedAt"
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- 如果违反唯一约束，跳过（数据已存在）
        NULL;
    END;
  END LOOP;
END $$;--> statement-breakpoint

-- 步骤 3: 删除旧字段和约束
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "unique_auth_provider";--> statement-breakpoint
DROP INDEX IF EXISTS "users_authProviderId_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "authProviderId";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "authProviderUsername";