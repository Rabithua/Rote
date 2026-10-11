CREATE TABLE "ai_conversations" (
	"owner_id" uuid NOT NULL,
	"id" varchar(160) NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"agent_conversation_id" varchar(160),
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "ai_conversations_owner_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "ai_conversations_positive_revision" CHECK ("ai_conversations"."revision" > 0),
	CONSTRAINT "ai_conversations_messages_array" CHECK (jsonb_typeof("ai_conversations"."messages") = 'array'),
	CONSTRAINT "ai_conversations_empty_tombstone" CHECK ("ai_conversations"."deleted_at" IS NULL OR ("ai_conversations"."messages" = '[]'::jsonb AND "ai_conversations"."agent_conversation_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "ai_conversations_owner_activity_idx" ON "ai_conversations" USING btree ("owner_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);