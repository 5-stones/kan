CREATE TABLE IF NOT EXISTS "theme" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"workspaceId" bigint,
	"name" varchar(255) NOT NULL,
	"css" varchar(20000),
	"variables" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "theme" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "themeId" varchar(255);--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "themeOverrides" jsonb;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "themeId" varchar(255);--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "themeOverrides" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "theme" ADD CONSTRAINT "theme_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board" ADD CONSTRAINT "board_themeId_theme_id_fk" FOREIGN KEY ("themeId") REFERENCES "public"."theme"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
