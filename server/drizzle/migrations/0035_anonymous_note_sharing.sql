CREATE TABLE "note_share_links" (
	"note_id" uuid PRIMARY KEY NOT NULL,
	"token" varchar(43) NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "note_share_links" ADD CONSTRAINT "note_share_links_note_id_rotes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."rotes"("id") ON DELETE cascade ON UPDATE cascade;