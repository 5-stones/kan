import type { dbClient } from "@kan/db/client";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as permissionRepo from "@kan/db/repository/permission.repo";
import * as userRepo from "@kan/db/repository/user.repo";

interface Auth {
  api: {
    signInMagicLink: (input: {
      email: string;
      callbackURL: string;
    }) => Promise<{ status: boolean }>;
  };
}

/**
 * Invites an email to a workspace as a "member" (VD) and sends the magic-link
 * invitation. Mirrors the self-hosted path of `member.invite` (no seat billing),
 * for use by NSPV admin onboarding.
 */
export async function inviteWorkspaceMember({
  db,
  auth,
  workspaceId,
  email,
  invitedBy,
}: {
  db: dbClient;
  auth: Auth;
  workspaceId: number;
  email: string;
  invitedBy: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const [existingUser, memberRole] = await Promise.all([
    userRepo.getByEmail(db, normalizedEmail),
    permissionRepo.getRoleByWorkspaceIdAndName(db, workspaceId, "member"),
  ]);

  const invite = await memberRepo.create(db, {
    workspaceId,
    email: normalizedEmail,
    userId: existingUser?.id ?? null,
    createdBy: invitedBy,
    role: "member",
    roleId: memberRole?.id ?? null,
    status: "invited",
  });
  if (!invite) throw new Error(`Unable to invite ${normalizedEmail}`);

  const { status } = await auth.api.signInMagicLink({
    email: normalizedEmail,
    callbackURL: `/boards?type=invite&memberPublicId=${invite.publicId}`,
  });

  if (!status) {
    await memberRepo.softDelete(db, {
      memberId: invite.id,
      deletedAt: new Date(),
      deletedBy: invitedBy,
    });
    throw new Error(`Failed to send invitation email to ${normalizedEmail}`);
  }

  return invite;
}
