import type { dbClient } from "@kan/db/client";
import * as coraggioRepo from "@kan/db/repository/coraggio.repo";

/** Whether the user still wants automated emails (reminders, assignments, mentions). */
export async function canEmailUser(db: dbClient, userId: string) {
  const optedOut = await coraggioRepo.getEmailOptedOutUserIds(db, [userId]);
  return !optedOut.has(userId);
}
