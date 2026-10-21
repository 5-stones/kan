ALTER TYPE "public"."notification_type" ADD VALUE 'card.overdue_reminder';--> statement-breakpoint
ALTER TABLE "coraggio_user_settings" ADD COLUMN "timeZone" text;