ALTER TYPE "public"."notification_type" ADD VALUE 'card.assigned';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'card.due_reminder';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coraggio_user_settings" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"emailNotificationsEnabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "coraggio_user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coraggio_user_settings" ADD CONSTRAINT "coraggio_user_settings_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
