ALTER TABLE "ai_token_usage_logs" DROP CONSTRAINT "ai_token_usage_logs_userid_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ALTER COLUMN "userid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ALTER COLUMN "promptTokens" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ALTER COLUMN "promptTokens" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ALTER COLUMN "completionTokens" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ALTER COLUMN "completionTokens" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ALTER COLUMN "totalTokens" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ALTER COLUMN "totalTokens" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD COLUMN "provider_id" varchar(100);--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD COLUMN "purpose" varchar(40);--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD COLUMN "status" varchar(20);--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD COLUMN "usage_status" varchar(20) DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD COLUMN "cache_hit_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD COLUMN "cache_miss_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD COLUMN "reasoning_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD CONSTRAINT "ai_token_usage_logs_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_token_usage_logs" ADD CONSTRAINT "ai_token_usage_logs_request_id_unique" UNIQUE("request_id");