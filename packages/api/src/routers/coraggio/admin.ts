import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { dbClient } from "@kan/db/client";
import * as boardRepo from "@kan/db/repository/board.repo";
import * as coraggioRepo from "@kan/db/repository/coraggio.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as permissionRepo from "@kan/db/repository/permission.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";
import { createLogger } from "@kan/logger";
import { generateSlug, generateUID } from "@kan/shared/utils";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  coraggioAdminProcedure,
  getCoraggioAdminEmails,
  isCoraggioAdmin,
} from "../../utils/coraggio/admin";
import {
  builtInTemplateSnapshot,
  loadBuiltInBoardTemplate,
} from "../../utils/coraggio/boardTemplate";
import { inviteWorkspaceMember } from "../../utils/coraggio/invite";
import { applyVdRolePermissions } from "../../utils/coraggio/roles";
import { assertPermission } from "../../utils/permissions";

const log = createLogger("coraggio-admin");

/** Built-in runtime theme key (themes/coraggio.yaml in the coraggio repo, via KAN_THEMES_DIR). */
const CORAGGIO_THEME_ID = "coraggio";

/** Adds every other NSPV admin with an account to the workspace as an active admin. */
async function addNspvAdmins(
  db: dbClient,
  workspaceId: number,
  createdBy: string,
) {
  const adminRole = await permissionRepo.getRoleByWorkspaceIdAndName(
    db,
    workspaceId,
    "admin",
  );
  const existingEmails = await coraggioRepo.getWorkspaceMemberEmails(
    db,
    workspaceId,
  );

  for (const email of getCoraggioAdminEmails()) {
    if (existingEmails.has(email)) continue;
    const user = await userRepo.getByEmail(db, email);
    if (!user) continue;

    await memberRepo.create(db, {
      userId: user.id,
      email: user.email,
      workspaceId,
      createdBy,
      role: "admin",
      roleId: adminRole?.id ?? null,
      status: "active",
    });
  }
}

/** Snapshot to clone for a new diocese board: a template board, or the built-in template. */
async function resolveTemplate(
  db: dbClient,
  userId: string,
  templateBoardPublicId: string | undefined,
) {
  if (!templateBoardPublicId) {
    const builtIn = loadBuiltInBoardTemplate();
    if (!builtIn) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No built-in board template is configured (CORAGGIO_BOARD_TEMPLATE); pick a template board",
      });
    }
    return { source: builtInTemplateSnapshot(builtIn), sourceBoardId: undefined };
  }

  const templateInfo = await boardRepo.getIdByPublicId(db, templateBoardPublicId);
  if (!templateInfo) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Template board not found" });
  }
  const template = await boardRepo.getByPublicId(
    db,
    templateBoardPublicId,
    userId,
    { members: [], labels: [], lists: [], dueDate: [], type: templateInfo.type },
  );
  if (!template) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Template board not found" });
  }
  const templateWorkspace = await workspaceRepo.getByPublicId(
    db,
    template.workspace.publicId,
  );
  if (!templateWorkspace) throw new TRPCError({ code: "NOT_FOUND" });
  await assertPermission(db, userId, templateWorkspace.id, "board:view");

  return {
    source: {
      ...template,
      lists: template.lists.map((list) => ({ ...list, cards: [] })),
    },
    sourceBoardId: templateInfo.id,
  };
}

export const coraggioAdminRouter = createTRPCRouter({
  /** Whether the current user is an NSPV admin (drives admin UI visibility). */
  me: protectedProcedure.query(({ ctx }) => ({
    isAdmin: isCoraggioAdmin(ctx.user),
  })),

  /** NSPV admin emails, so the UI can leave internal staff out of assignee pickers. */
  nspvAdminEmails: protectedProcedure.query(() => getCoraggioAdminEmails()),

  listWorkspaces: coraggioAdminProcedure.query(({ ctx }) =>
    coraggioRepo.listAllWorkspaces(ctx.db),
  ),

  listTemplateBoards: coraggioAdminProcedure.query(({ ctx }) =>
    coraggioRepo.listTemplateBoards(ctx.db),
  ),

  /** The built-in board template (CORAGGIO_BOARD_TEMPLATE), or null when not configured. */
  builtInTemplate: coraggioAdminProcedure.query(() => {
    const template = loadBuiltInBoardTemplate();
    return template && {
      name: template.name,
      lists: template.lists,
      labels: template.labels,
      hasCustomFields: !!template.customFieldsConfig,
    };
  }),

  /** Re-applies Coraggio role defaults (VD restrictions) and NSPV admin membership. */
  applyDefaults: coraggioAdminProcedure
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

      await applyVdRolePermissions(ctx.db, workspace.id);
      await addNspvAdmins(ctx.db, workspace.id, ctx.user!.id);
      return { success: true };
    }),

  /**
   * Interim onboarding for a diocese: a workspace per diocese with a board cloned
   * from a template (statuses, custom fields, labels), VD role restrictions,
   * NSPV admins as workspace admins, and email invites for the VDs.
   * Without templateBoardPublicId the built-in template file is used.
   */
  onboardDiocese: coraggioAdminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(64),
        boardName: z.string().trim().min(1).max(100),
        templateBoardPublicId: z.string().min(12).optional(),
        vdEmails: z.array(z.string().trim().toLowerCase().email()).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      // Resolve the template before creating anything
      const { source, sourceBoardId } = await resolveTemplate(
        ctx.db,
        userId,
        input.templateBoardPublicId,
      );

      // 1. Workspace (seeds system roles; the calling admin becomes its admin)
      const workspacePublicId = generateUID();
      const workspace = await workspaceRepo.create(ctx.db, {
        publicId: workspacePublicId,
        name: input.name,
        slug: workspacePublicId,
        createdBy: userId,
        createdByEmail: ctx.user!.email,
        themeId: CORAGGIO_THEME_ID,
      });
      const newWorkspace = await workspaceRepo.getByPublicId(
        ctx.db,
        workspacePublicId,
      );
      if (!workspace || !newWorkspace) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      // 2. Board cloned from the template (cross-workspace, so not via board.create)
      const board = await boardRepo.createFromSnapshot(ctx.db, {
        source,
        workspaceId: newWorkspace.id,
        createdBy: userId,
        slug: generateSlug(input.boardName) || generateUID(),
        name: input.boardName,
        type: "regular",
        sourceBoardId,
        themeId: CORAGGIO_THEME_ID,
      });

      // 3. Roles and NSPV admins
      await applyVdRolePermissions(ctx.db, newWorkspace.id);
      await addNspvAdmins(ctx.db, newWorkspace.id, userId);

      // 4. Invite VDs (as "member", the restricted VD role)
      const invites = await Promise.all(
        input.vdEmails.map(async (email) => {
          try {
            await inviteWorkspaceMember({
              db: ctx.db,
              auth: ctx.auth,
              workspaceId: newWorkspace.id,
              email,
              invitedBy: userId,
            });
            return { email, invited: true as const };
          } catch (error) {
            log.error({ err: error, email }, "Failed to invite VD during onboarding");
            return {
              email,
              invited: false as const,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );

      return {
        workspacePublicId,
        boardPublicId: board?.publicId,
        invites,
      };
    }),
});
