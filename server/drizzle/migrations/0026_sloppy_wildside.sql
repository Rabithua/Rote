CREATE TABLE "apns_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userid" uuid NOT NULL,
	"installationId" uuid NOT NULL,
	"token" text NOT NULL,
	"environment" varchar(16) NOT NULL,
	"masterEnabled" boolean DEFAULT true NOT NULL,
	"timeZone" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"lastSeenAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apns_devices_installation_id_unique" UNIQUE("installationId"),
	CONSTRAINT "apns_devices_token_environment_unique" UNIQUE("token","environment")
);
--> statement-breakpoint
CREATE TABLE "push_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eventId" uuid NOT NULL,
	"deviceId" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"apnsId" varchar(100),
	"lastError" text,
	"sentAt" timestamp (6) with time zone,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_deliveries_event_device_unique" UNIQUE("eventId","deviceId")
);
--> statement-breakpoint
CREATE TABLE "push_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userid" uuid NOT NULL,
	"type" varchar(80) NOT NULL,
	"category" varchar(30) NOT NULL,
	"title" text,
	"body" text,
	"titleLocKey" varchar(100),
	"bodyLocKey" varchar(100),
	"route" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupeKey" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"availableAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp (6) with time zone,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_events_dedupe_key_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "push_preferences" (
	"userid" uuid PRIMARY KEY NOT NULL,
	"reactionsEnabled" boolean DEFAULT true NOT NULL,
	"accountEnabled" boolean DEFAULT true NOT NULL,
	"systemEnabled" boolean DEFAULT true NOT NULL,
	"dailyReminderEnabled" boolean DEFAULT true NOT NULL,
	"dailyReminderTime" varchar(5) DEFAULT '21:30' NOT NULL,
	"timeZone" varchar(100) NOT NULL,
	"nextReminderAt" timestamp (6) with time zone,
	"createdAt" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apns_devices" ADD CONSTRAINT "apns_devices_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_event_id_push_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."push_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_device_id_apns_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."apns_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_events" ADD CONSTRAINT "push_events_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_preferences" ADD CONSTRAINT "push_preferences_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apns_devices_userid_idx" ON "apns_devices" USING btree ("userid");--> statement-breakpoint
CREATE INDEX "push_deliveries_pending_idx" ON "push_deliveries" USING btree ("status","nextAttemptAt");--> statement-breakpoint
CREATE INDEX "push_events_pending_idx" ON "push_events" USING btree ("status","availableAt");--> statement-breakpoint
CREATE INDEX "push_preferences_reminder_due_idx" ON "push_preferences" USING btree ("dailyReminderEnabled","nextReminderAt");