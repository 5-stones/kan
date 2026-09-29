import type { dbClient } from "@kan/db/client";
import * as coraggioRepo from "@kan/db/repository/coraggio.repo";
import * as notificationRepo from "@kan/db/repository/notification.repo";
import { sendEmail } from "@kan/email";
import { createLogger } from "@kan/logger";
import { getFollowUpTask } from "@kan/shared";

const log = createLogger("coraggio-reminders");

export function getReminderTimeZone() {
  return process.env.CORAGGIO_REMINDER_TZ || "America/New_York";
}

/** YYYY-MM-DD for `now` in the given IANA time zone. */
export function toIsoDateInTimeZone(now: Date, timeZone: string) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function formatLongDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}

/**
 * Emails each assigned member about contacts whose follow-up date is today.
 * Idempotent: a `card.due_reminder` notification row per user/card/date prevents resends.
 */
export async function sendFollowUpReminders({
  db,
  baseUrl,
  now = new Date(),
  timeZone = getReminderTimeZone(),
}: {
  db: dbClient;
  baseUrl: string;
  now?: Date;
  timeZone?: string;
}) {
  const date = toIsoDateInTimeZone(now, timeZone);
  const rows = await coraggioRepo.getCardsDueOn(db, date, timeZone);
  const optedOut = await coraggioRepo.getEmailOptedOutUserIds(db, [
    ...new Set(rows.map((row) => row.userId)),
  ]);

  const stats = { date, candidates: rows.length, sent: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    if (optedOut.has(row.userId)) {
      stats.skipped++;
      continue;
    }

    try {
      const alreadySent = await coraggioRepo.dueReminderExists(db, {
        userId: row.userId,
        cardId: row.cardId,
        date,
      });
      if (alreadySent) {
        stats.skipped++;
        continue;
      }

      const task = getFollowUpTask(row.customData);

      await sendEmail(
        row.email,
        task
          ? `Follow up with ${row.cardTitle}: ${task.split("\n")[0]}`
          : `Follow up with ${row.cardTitle} today`,
        "CORAGGIO_FOLLOW_UP_REMINDER",
        {
          contactName: row.cardTitle,
          task,
          followUpDate: formatLongDate(date),
          boardName: row.boardName,
          cardUrl: `${baseUrl}/cards/${row.cardPublicId}`,
        },
      );

      // Recorded after sending so a failed send is retried on the next run
      await notificationRepo.create(db, {
        type: "card.due_reminder",
        userId: row.userId,
        cardId: row.cardId,
        workspaceId: row.workspaceId,
        metadata: JSON.stringify({ date }),
      });
      stats.sent++;
    } catch (error) {
      stats.failed++;
      log.error(
        { err: error, userId: row.userId, cardPublicId: row.cardPublicId },
        "Failed to send follow-up reminder",
      );
    }
  }

  log.info(stats, "Follow-up reminders processed");
  return stats;
}
