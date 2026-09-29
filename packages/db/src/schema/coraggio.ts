// Coraggio fork-owned tables. Kept in a separate file to avoid upstream merge conflicts.
import { relations } from "drizzle-orm";
import { boolean, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const coraggioUserSettings = pgTable("coraggio_user_settings", {
  userId: uuid("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // Global switch for automated emails (follow-up reminders, assignments, mentions)
  emailNotificationsEnabled: boolean("emailNotificationsEnabled")
    .notNull()
    .default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt"),
}).enableRLS();

export const coraggioUserSettingsRelations = relations(
  coraggioUserSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [coraggioUserSettings.userId],
      references: [users.id],
    }),
  }),
);
