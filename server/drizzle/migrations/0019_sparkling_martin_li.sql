CREATE TABLE "note_import_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" uuid NOT NULL,
	"roteId" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"accountId" varchar(100) NOT NULL,
	"externalId" varchar(100) NOT NULL,
	"attachmentMap" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_import_sources_rote_id_unique" UNIQUE("roteId"),
	CONSTRAINT "note_import_sources_owner_source_unique" UNIQUE("ownerId","provider","accountId","externalId")
);
--> statement-breakpoint
ALTER TABLE "note_import_sources" ADD CONSTRAINT "note_import_sources_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "note_import_sources" ADD CONSTRAINT "note_import_sources_roteId_rotes_id_fk" FOREIGN KEY ("roteId") REFERENCES "public"."rotes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "note_import_sources_owner_idx" ON "note_import_sources" USING btree ("ownerId");
