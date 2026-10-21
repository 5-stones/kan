import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as coraggioRepo from "@kan/db/repository/coraggio.repo";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const coraggioSettingsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    return coraggioRepo.getUserSettings(ctx.db, userId);
  }),

  update: protectedProcedure
    .input(
      z.object({
        emailNotificationsEnabled: z.boolean().optional(),
        // IANA name for the daily digest; null falls back to CORAGGIO_REMINDER_TZ
        timeZone: z.string().min(1).max(64).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // The reminder query converts dates with it, so Postgres must know it
      if (input.timeZone && !(await coraggioRepo.isKnownTimeZone(ctx.db, input.timeZone))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown time zone ${input.timeZone}`,
        });
      }

      return coraggioRepo.upsertUserSettings(ctx.db, userId, input);
    }),
});
