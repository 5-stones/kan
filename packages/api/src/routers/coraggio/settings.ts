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
    .input(z.object({ emailNotificationsEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      return coraggioRepo.upsertUserSettings(ctx.db, userId, input);
    }),
});
