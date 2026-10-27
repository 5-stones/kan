import { TRPCError } from "@trpc/server";

import { protectedProcedure } from "../../trpc";

/** NSPV admin emails, from the comma-separated CORAGGIO_ADMIN_EMAILS env var. */
export function getCoraggioAdminEmails(): string[] {
  return (process.env.CORAGGIO_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isCoraggioAdmin(user: { email?: string | null } | null | undefined) {
  const email = user?.email?.trim().toLowerCase();
  return !!email && getCoraggioAdminEmails().includes(email);
}

/**
 * Drops NSPV admins from a workspace's member list unless the viewer is one:
 * they're admins of every diocese, but dioceses shouldn't see them as members.
 */
export function hideNspvAdminMembers<
  T extends { email?: string | null; user?: { email?: string | null } | null },
>(members: T[], viewer: { email?: string | null } | null | undefined): T[] {
  if (isCoraggioAdmin(viewer)) return members;
  return members.filter(
    (member) => !isCoraggioAdmin({ email: member.user?.email ?? member.email }),
  );
}

/** Procedure restricted to NSPV admins (internal Coraggio staff). */
export const coraggioAdminProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (!isCoraggioAdmin(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  },
);
