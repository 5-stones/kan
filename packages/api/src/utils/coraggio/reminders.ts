import type { dbClient } from "@kan/db/client";
import * as coraggioRepo from "@kan/db/repository/coraggio.repo";
import * as notificationRepo from "@kan/db/repository/notification.repo";
import { sendEmail } from "@kan/email";
import { createLogger } from "@kan/logger";
import { getContactParish, getFollowUpTask } from "@kan/shared";

const log = createLogger("coraggio-reminders");

/** Local hour (in each VD's time zone) from which the daily digest goes out. */
export const DIGEST_HOUR = 7;
/** The overdue email goes out once, this many days after a follow-up date that wasn't moved. */
export const OVERDUE_AFTER_DAYS = 3;
/**
 * How long after OVERDUE_AFTER_DAYS an overdue email can still go out (e.g. if
 * the cron was down). Older follow-ups never get one, so old data doesn't
 * trigger a burst of emails.
 */
const OVERDUE_GRACE_DAYS = 6;

/** Default time zone for VDs who haven't set one. */
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

export function formatLongDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}

type Candidate = Awaited<
  ReturnType<typeof coraggioRepo.getFollowUpReminderCandidates>
>[number];

const reminderKey = (
  type: "card.due_reminder" | "card.overdue_reminder",
  row: Candidate,
  date: string,
) => `${type}:${row.userId}:${row.cardId}:${JSON.stringify({ date })}`;

export function followUpDigestSubject(contactNames: string[]) {
  return contactNames.length === 1
    ? `Follow up with ${contactNames[0]} today`
    : `${contactNames.length} follow-ups today`;
}

export function overdueSubject(contactName: string, daysOverdue: number) {
  return `${contactName}'s follow-up is ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} overdue`;
}

/**
 * Runs hourly. Once it's DIGEST_HOUR or later in a VD's time zone, emails them
 * one digest of the contacts whose follow-up date is today, plus one email per
 * contact that's OVERDUE_AFTER_DAYS overdue.
 *
 * Idempotent: `card.due_reminder` (metadata `{date: today}`) and
 * `card.overdue_reminder` (metadata `{date: follow-up date}`) notification rows
 * are written after each successful send, so re-runs skip them and failed sends
 * are retried on the next run.
 */
export async function sendFollowUpReminders({
  db,
  baseUrl,
  now = new Date(),
}: {
  db: dbClient;
  baseUrl: string;
  now?: Date;
}) {
  const rows = await coraggioRepo.getFollowUpReminderCandidates(db, {
    now,
    defaultTimeZone: getReminderTimeZone(),
    fromHour: DIGEST_HOUR,
    maxDaysOverdue: OVERDUE_AFTER_DAYS + OVERDUE_GRACE_DAYS,
  });
  const sent = await coraggioRepo.getSentFollowUpReminderKeys(db, [
    ...new Set(rows.map((row) => row.userId)),
  ]);

  const dueByUser = new Map<string, Candidate[]>();
  const overdue: Candidate[] = [];
  for (const row of rows) {
    if (row.dueOn === row.today) {
      if (sent.has(reminderKey("card.due_reminder", row, row.today))) continue;
      dueByUser.set(row.userId, [...(dueByUser.get(row.userId) ?? []), row]);
    } else if (row.daysOverdue >= OVERDUE_AFTER_DAYS) {
      if (sent.has(reminderKey("card.overdue_reminder", row, row.dueOn))) continue;
      overdue.push(row);
    }
  }

  const stats = {
    candidates: rows.length,
    digests: 0,
    overdue: 0,
    failed: 0,
  };
  const cardUrl = (row: Candidate) => `${baseUrl}/cards/${row.cardPublicId}`;

  for (const [userId, cards] of dueByUser) {
    const first = cards[0]!;
    // A board link filtered to today and this VD when all contacts share a board
    const sameBoard = cards.every((card) => card.boardPublicId === first.boardPublicId);
    const listUrl = sameBoard
      ? `${baseUrl}/boards/${first.boardPublicId}?dueDate=today&members=${first.memberPublicId}`
      : `${baseUrl}/boards`;

    try {
      await sendEmail(
        first.email,
        followUpDigestSubject(cards.map((card) => card.cardTitle)),
        "CORAGGIO_FOLLOW_UP_REMINDER",
        {
          recipientName: first.userName?.trim() ?? "",
          listUrl,
          contacts: cards.map((card) => ({
            name: card.cardTitle,
            parish: getContactParish(card.customData),
            task: getFollowUpTask(card.customData),
            followUpDate: formatLongDate(card.dueOn),
            cardUrl: cardUrl(card),
          })),
        },
      );

      for (const card of cards) {
        await notificationRepo.create(db, {
          type: "card.due_reminder",
          userId,
          cardId: card.cardId,
          workspaceId: card.workspaceId,
          metadata: JSON.stringify({ date: card.today }),
        });
      }
      stats.digests++;
    } catch (error) {
      stats.failed++;
      log.error({ err: error, userId }, "Failed to send follow-up digest");
    }
  }

  for (const row of overdue) {
    try {
      await sendEmail(
        row.email,
        overdueSubject(row.cardTitle, row.daysOverdue),
        "CORAGGIO_FOLLOW_UP_OVERDUE",
        {
          contactName: row.cardTitle,
          parish: getContactParish(row.customData),
          task: getFollowUpTask(row.customData),
          followUpDate: formatLongDate(row.dueOn),
          daysOverdue: row.daysOverdue,
          cardUrl: cardUrl(row),
        },
      );

      await notificationRepo.create(db, {
        type: "card.overdue_reminder",
        userId: row.userId,
        cardId: row.cardId,
        workspaceId: row.workspaceId,
        metadata: JSON.stringify({ date: row.dueOn }),
      });
      stats.overdue++;
    } catch (error) {
      stats.failed++;
      log.error(
        { err: error, userId: row.userId, cardPublicId: row.cardPublicId },
        "Failed to send overdue follow-up email",
      );
    }
  }

  log.info(stats, "Follow-up reminders processed");
  return stats;
}
