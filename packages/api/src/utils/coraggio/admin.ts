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

/** Procedure restricted to NSPV admins (internal Coraggio staff). */
export const coraggioAdminProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (!isCoraggioAdmin(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  },
);
