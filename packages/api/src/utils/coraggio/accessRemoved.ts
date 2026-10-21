import type { dbClient } from "@kan/db/client";
import * as userRepo from "@kan/db/repository/user.repo";
import { sendEmail } from "@kan/email";
import { createLogger } from "@kan/logger";

const log = createLogger("coraggio-access-removed");

/**
 * Tells a removed member they no longer have access to the diocese. A security
 * email: sent even when the user turned off notifications. Pending invites and
 * members removing themselves get nothing.
 */
export async function sendAccessRemovedEmail({
  db,
  member,
  workspaceName,
  actorUserId,
}: {
  db: dbClient;
  member: { userId: string | null; status: string };
  workspaceName: string;
  actorUserId: string;
}) {
  if (member.status !== "active" || !member.userId) return;
  if (member.userId === actorUserId) return;

  try {
    const [user, actor] = await Promise.all([
      userRepo.getById(db, member.userId),
      userRepo.getById(db, actorUserId),
    ]);
    if (!user) return;

    await sendEmail(
      user.email,
      "Your coragg.io access has changed",
      "CORAGGIO_ACCESS_REMOVED",
      {
        workspaceName,
        removerName: actor?.name?.trim() || actor?.email || "your team",
        removerEmail: actor?.email ?? "",
      },
    );
    log.info({ userId: user.id }, "Access removed email sent");
  } catch (error) {
    log.error(
      { err: error, userId: member.userId },
      "Failed to send access removed email",
    );
  }
}
