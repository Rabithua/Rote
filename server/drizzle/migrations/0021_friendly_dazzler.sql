CREATE TABLE "user_blocks" (
	"blockerId" uuid NOT NULL,
	"blockedId" uuid NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_blocker_blocked_pk" PRIMARY KEY("blockerId","blockedId"),
	CONSTRAINT "user_blocks_no_self_block" CHECK ("user_blocks"."blockerId" <> "user_blocks"."blockedId")
);
--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blockerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blockedId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_blocks_blocker_id_idx" ON "user_blocks" USING btree ("blockerId");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks" USING btree ("blockedId");