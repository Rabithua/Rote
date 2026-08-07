CREATE TABLE "billing_grants" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"issuer" varchar(100) NOT NULL,
	"instance_id" varchar(100) NOT NULL,
	"revision" bigint NOT NULL,
	"plan_id" varchar(50),
	"status" varchar(32) NOT NULL,
	"product_id" varchar(255),
	"entitlement_expires_at" timestamp (6) with time zone,
	"lease_expires_at" timestamp (6) with time zone,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"snapshot_hash" varchar(64) NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_grants_revision_non_negative" CHECK ("billing_grants"."revision" >= 0),
	CONSTRAINT "billing_grants_valid_status" CHECK ("billing_grants"."status" IN ('active', 'grace_period', 'none'))
);
--> statement-breakpoint
CREATE TABLE "billing_inbound_deliveries" (
	"direction" varchar(32) NOT NULL,
	"delivery_id" uuid NOT NULL,
	"key_id" varchar(100) NOT NULL,
	"body_hash" varchar(64) NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp (6) with time zone,
	CONSTRAINT "billing_inbound_deliveries_direction_delivery_id_pk" PRIMARY KEY("direction","delivery_id"),
	CONSTRAINT "billing_inbound_deliveries_paid_to_rote_direction" CHECK ("billing_inbound_deliveries"."direction" = 'paid_to_rote')
);
--> statement-breakpoint
ALTER TABLE "billing_grants" ADD CONSTRAINT "billing_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "billing_grants_lease_expires_at_idx" ON "billing_grants" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "billing_inbound_deliveries_created_at_idx" ON "billing_inbound_deliveries" USING btree ("created_at");