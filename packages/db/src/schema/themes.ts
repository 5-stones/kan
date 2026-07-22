import { relations } from "drizzle-orm";
import {
  bigint,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { boards } from "./boards";
import { workspaces } from "./workspaces";

export const themes = pgTable(
  "theme",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    workspaceId: bigint("workspaceId", { mode: "number" }).references(
      () => workspaces.id,
      { onDelete: "cascade" }
    ), // Custom themes can optionally belong to a workspace, otherwise built-in/global
    name: varchar("name", { length: 255 }).notNull(),
    css: varchar("css", { length: 20000 }), // Custom CSS string
    variables: jsonb("variables"), // JSON for pickers
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
  }
).enableRLS();

export const themesRelations = relations(themes, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [themes.workspaceId],
    references: [workspaces.id],
    relationName: "workspaceThemes",
  }),
  workspacesApplied: many(workspaces, { relationName: "workspaceTheme" }),
  boardsApplied: many(boards, { relationName: "boardTheme" }),
}));
