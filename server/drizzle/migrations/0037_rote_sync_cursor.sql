CREATE TABLE "rote_sync_states" (
	"userid" uuid PRIMARY KEY NOT NULL,
	"revision" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rote_changes" ADD COLUMN "revision" bigint;--> statement-breakpoint
ALTER TABLE "rote_sync_states" ADD CONSTRAINT "rote_sync_states_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rote_changes_userid_revision_idx" ON "rote_changes" USING btree ("userid","revision");