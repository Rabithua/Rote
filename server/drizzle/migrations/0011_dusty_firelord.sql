CREATE TABLE "open_key_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"openKeyId" uuid NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"clientIp" varchar(45),
	"userAgent" text,
	"statusCode" integer,
	"responseTime" integer,
	"errorMessage" text,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "open_key_usage_logs" ADD CONSTRAINT "open_key_usage_logs_openKeyId_user_open_keys_id_fk" FOREIGN KEY ("openKeyId") REFERENCES "public"."user_open_keys"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "open_key_usage_logs_openKeyId_idx" ON "open_key_usage_logs" USING btree ("openKeyId");--> statement-breakpoint
CREATE INDEX "open_key_usage_logs_createdAt_idx" ON "open_key_usage_logs" USING btree ("createdAt");