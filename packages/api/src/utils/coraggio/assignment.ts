import { env } from "next-runtime-env";

import type { dbClient } from "@kan/db/client";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as coraggioRepo from "@kan/db/repository/coraggio.repo";
import * as notificationRepo from "@kan/db/repository/notification.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import { sendEmail } from "@kan/email";
import { createLogger } from "@kan/logger";
import { getContactParish } from "@kan/shared";

import {
  formatLongDate,
  getReminderTimeZone,
  toIsoDateInTimeZone,
} from "./reminders";

const log = createLogger("coraggio-assignment");

/**
 * Emails members who were assigned to a card by someone else.
 * Members assigning themselves, pending invites and opted-out users are skipped.
 */
export async function sendAssignmentEmails({
  db,
  cardPublicId,
  workspaceMemberIds,
  actorUserId,
}: {
  db: dbClient;
  cardPublicId: string;
  workspaceMemberIds: number[];
  actorUserId: string;
}) {
  try {
    const members = await coraggioRepo.getActiveMembersWithUsers(
      db,
      workspaceMemberIds,
    );
    const recipients = members.filter(
      (member) => member.user && member.user.id !== actorUserId,
    );
    if (recipients.length === 0) return;

    const recipientIds = recipients.map((member) => member.user!.id);
    const [optedOut, timeZones, card, cardDetail, actor] = await Promise.all([
      coraggioRepo.getEmailOptedOutUserIds(db, recipientIds),
      coraggioRepo.getUserTimeZones(db, recipientIds),
      cardRepo.getWorkspaceAndCardIdByCardPublicId(db, cardPublicId),
      coraggioRepo.getCardForEmail(db, cardPublicId),
      userRepo.getById(db, actorUserId),
    ]);
    if (!card || !cardDetail) return;

    const assignerName = actor?.name?.trim() || actor?.email || "Someone";
    const cardUrl = `${env("NEXT_PUBLIC_BASE_URL")}/cards/${cardPublicId}`;
    const contactName = cardDetail.title;
    const parish = getContactParish(
      cardDetail.customData as Record<string, unknown> | null,
    );

    await Promise.all(
      recipients.map(async (member) => {
        const user = member.user!;
        if (optedOut.has(user.id)) return;

        // Follow-up dates are calendar days; show the day in the recipient's time zone
        const followUpDate = cardDetail.dueDate
          ? formatLongDate(
              toIsoDateInTimeZone(
                cardDetail.dueDate,
                timeZones.get(user.id) ?? getReminderTimeZone(),
              ),
            )
          : "";

        try {
          await notificationRepo.create(db, {
            type: "card.assigned",
            userId: user.id,
            cardId: card.id,
            workspaceId: card.workspaceId,
          });

          await sendEmail(
            user.email,
            `${assignerName} assigned ${contactName} to you`,
            "CORAGGIO_CARD_ASSIGNED",
            {
              assignerName,
              contactName,
              parish,
              followUpDate,
              cardUrl,
            },
          );
          log.info({ userId: user.id, cardPublicId }, "Assignment email sent");
        } catch (error) {
          log.error(
            { err: error, userId: user.id, cardPublicId },
            "Failed to send assignment email",
          );
        }
      }),
    );
  } catch (error) {
    log.error({ err: error, cardPublicId }, "Error sending assignment emails");
  }
}
