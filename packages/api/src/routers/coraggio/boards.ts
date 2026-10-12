import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as coraggioRepo from "@kan/db/repository/coraggio.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { splitMainAndArchiveBoards } from "../../utils/coraggio/boards";
import { assertPermission } from "../../utils/permissions";

export const coraggioBoardsRouter = createTRPCRouter({
  /** The diocese's main board and archive board (with lists), for navigation and archiving. */
  nav: protectedProcedure
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

      await assertPermission(ctx.db, userId, workspace.id, "board:view");

      const boards = await coraggioRepo.getWorkspaceBoardsWithLists(
        ctx.db,
        workspace.id,
      );
      const { main, archive } = splitMainAndArchiveBoards(boards);
      const toNav = (board: (typeof boards)[number] | null) =>
        board && {
          publicId: board.publicId,
          name: board.name,
          lists: board.lists.map(({ publicId, name }) => ({ publicId, name })),
        };

      return { main: toNav(main), archive: toNav(archive) };
    }),
});
