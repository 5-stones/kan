import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as themeRepo from "@kan/db/repository/theme.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";

import { createThemeSchema, updateThemeSchema } from "../schemas/theme";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertPermission } from "../utils/permissions";
import { loadRuntimeThemes } from "../utils/runtimeThemes";

export const themeRouter = createTRPCRouter({
  /** Themes loaded from the `KAN_THEMES_DIR` folder, keyed by filename. */
  runtime: protectedProcedure.query(() => loadRuntimeThemes()),

  list: protectedProcedure
    .meta({
      openapi: {
        summary: "List custom themes for a workspace",
        method: "GET",
        path: "/workspaces/{workspacePublicId}/themes",
        description: "Retrieves all custom themes for a workspace",
        tags: ["Themes"],
        protect: true,
      },
    })
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );

      if (!workspace)
        throw new TRPCError({
          message: `Workspace with public ID ${input.workspacePublicId} not found`,
          code: "NOT_FOUND",
        });

      await assertPermission(ctx.db, userId, workspace.id, "workspace:view");

      return themeRepo.findManyByWorkspace(ctx.db, String(workspace.id));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId)
        throw new TRPCError({ message: `User not authenticated`, code: "UNAUTHORIZED" });

      const theme = await themeRepo.findById(ctx.db, input.id);
      if (!theme) return null;

      if (theme.workspaceId) {
        await assertPermission(ctx.db, userId, Number(theme.workspaceId), "workspace:view");
      }

      return theme;
    }),

  create: protectedProcedure
    .meta({
      openapi: {
        summary: "Create a custom theme",
        method: "POST",
        path: "/themes",
        description: "Creates a new custom theme for a workspace",
        tags: ["Themes"],
        protect: true,
      },
    })
    .input(createThemeSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );

      if (!workspace)
        throw new TRPCError({
          message: `Workspace with public ID ${input.workspacePublicId} not found`,
          code: "NOT_FOUND",
        });

      await assertPermission(ctx.db, userId, workspace.id, "workspace:edit");

      return themeRepo.create(ctx.db, {
        workspaceId: String(workspace.id),
        name: input.name,
        css: input.css,
        imports: input.imports,
        variables: input.variables,
      });
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        summary: "Update a custom theme",
        method: "PUT",
        path: "/themes/{id}",
        description: "Updates a custom theme",
        tags: ["Themes"],
        protect: true,
      },
    })
    .input(updateThemeSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const theme = await themeRepo.findById(ctx.db, input.id);
      if (!theme) {
        throw new TRPCError({
          message: `Theme not found`,
          code: "NOT_FOUND",
        });
      }

      if (theme.workspaceId) {
        // Need to check workspace edit permission
        await assertPermission(ctx.db, userId, Number(theme.workspaceId), "workspace:edit");
      } else {
        throw new TRPCError({
          message: `Cannot edit global themes`,
          code: "FORBIDDEN",
        });
      }

      return themeRepo.update(ctx.db, input.id, {
        name: input.name,
        css: input.css,
        imports: input.imports,
        variables: input.variables,
      });
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        summary: "Delete a custom theme",
        method: "DELETE",
        path: "/themes/{id}",
        description: "Deletes a custom theme",
        tags: ["Themes"],
        protect: true,
      },
    })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const theme = await themeRepo.findById(ctx.db, input.id);
      if (!theme) {
        throw new TRPCError({
          message: `Theme not found`,
          code: "NOT_FOUND",
        });
      }

      if (theme.workspaceId) {
        await assertPermission(ctx.db, userId, Number(theme.workspaceId), "workspace:edit");
      } else {
        throw new TRPCError({
          message: `Cannot delete global themes`,
          code: "FORBIDDEN",
        });
      }

      return themeRepo.delete(ctx.db, input.id);
    }),
});