import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { dbClient } from "@kan/db/client";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import * as coraggioRepo from "@kan/db/repository/coraggio.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";
import {
  buildContactImportTemplate,
  CSV_IMPORT_MAX_ROWS,
  getContactCsvCustomColumns,
  getContactCsvHeaders,
  getContactImportGuide,
  getCsvCustomValue,
  getFollowUpTask,
  parseCsv,
  parseCustomFieldsConfig,
  toCsv,
  validateContactImport,
} from "@kan/shared";
import type { CustomFieldsConfig } from "@kan/shared";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { splitMainAndArchiveBoards } from "../../utils/coraggio/boards";
import {
  getReminderTimeZone,
  isValidTimeZone,
  toIsoDateInTimeZone,
  zonedMidnightToUtc,
} from "../../utils/coraggio/reminders";
import { assertCanEdit, assertPermission } from "../../utils/permissions";

function htmlToText(html: string | null) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseConfigSafe(yaml: string | null | undefined): CustomFieldsConfig {
  if (!yaml) return {};
  try {
    return parseCustomFieldsConfig(yaml);
  } catch {
    return {};
  }
}

export const coraggioContactsRouter = createTRPCRouter({
  /** Star/unstar a contact. Shared across the board (stored at customData.meta.starred). */
  setStarred: protectedProcedure
    .input(z.object({ cardPublicId: z.string().min(12), starred: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const card = await cardRepo.getWorkspaceAndCardIdByCardPublicId(
        ctx.db,
        input.cardPublicId,
      );
      if (!card) throw new TRPCError({ code: "NOT_FOUND" });

      await assertCanEdit(
        ctx.db,
        userId,
        card.workspaceId,
        "card:edit",
        card.createdBy,
      );

      const result = await coraggioRepo.setCardStarred(
        ctx.db,
        card.id,
        input.starred,
      );
      return { starred: input.starred, customData: result?.customData };
    }),

  /**
   * Moves a contact to a status on the diocese's main or archive board (archive /
   * restore). Labels follow by name, since labels belong to a board.
   */
  moveToBoard: protectedProcedure
    .input(
      z.object({
        cardPublicId: z.string().min(12),
        listPublicId: z.string().min(12),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const card = await cardRepo.getWorkspaceAndCardIdByCardPublicId(
        ctx.db,
        input.cardPublicId,
      );
      if (!card) throw new TRPCError({ code: "NOT_FOUND" });

      await assertCanEdit(
        ctx.db,
        userId,
        card.workspaceId,
        "card:edit",
        card.createdBy,
      );

      const { main, archive } = splitMainAndArchiveBoards(
        await coraggioRepo.getWorkspaceBoardsWithLists(ctx.db, card.workspaceId),
      );
      const target = [main, archive]
        .flatMap((board) =>
          board ? board.lists.map((list) => ({ list, boardId: board.id })) : [],
        )
        .find(({ list }) => list.publicId === input.listPublicId);
      if (!target) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contacts can only move to a status on the main or archive board",
        });
      }

      const existing = await cardRepo.getByPublicId(ctx.db, input.cardPublicId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.listId === target.list.id) return { success: true };

      await cardRepo.reorder(ctx.db, {
        cardId: card.id,
        newListId: target.list.id,
        newIndex: undefined,
      });
      await coraggioRepo.relinkCardLabelsToBoard(ctx.db, card.id, target.boardId);
      await cardActivityRepo.bulkCreate(ctx.db, [
        {
          type: "card.updated.list",
          cardId: card.id,
          createdBy: userId,
          fromListId: existing.listId,
          toListId: target.list.id,
        },
      ]);

      return { success: true };
    }),

  /** Search contacts by name or any custom field value (email, phone, parish, ...). */
  search: protectedProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        query: z.string().trim().min(1).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

      await assertPermission(ctx.db, userId, workspace.id, "workspace:view");

      const results = await coraggioRepo.searchContacts(
        ctx.db,
        workspace.id,
        input.query,
      );

      return results.map(({ customData, ...result }) => ({
        ...result,
        matchedField: findMatchedValue(customData, input.query),
      }));
    }),

  /** All contacts on a board as a CSV string, one column per configured field. */
  exportCsv: protectedProcedure
    .input(z.object({ boardPublicId: z.string().min(12) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const board = await coraggioRepo.getBoardForExport(
        ctx.db,
        input.boardPublicId,
      );
      if (!board) throw new TRPCError({ code: "NOT_FOUND" });

      await assertPermission(ctx.db, userId, board.workspaceId, "board:view");

      const config = parseConfigSafe(board.customFieldsConfig);
      const customColumns = getContactCsvCustomColumns(config);
      const headers = getContactCsvHeaders(config);
      const timeZone = getReminderTimeZone();

      const header = [
        headers.name,
        headers.status,
        headers.dueDate,
        headers.followUpTask,
        headers.members,
        headers.labels,
        headers.starred,
        headers.notes,
        ...customColumns.map((column) => column.header),
        headers.created,
        headers.link,
      ];

      const lists = await coraggioRepo.getBoardContactsForExport(
        ctx.db,
        board.id,
      );
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

      const rows = lists.flatMap((list) =>
        list.cards.map((card) => {
          const customData = card.customData as Record<string, unknown> | null;
          return [
            card.title,
            list.name,
            card.dueDate ? toIsoDateInTimeZone(card.dueDate, timeZone) : "",
            getFollowUpTask(customData),
            card.members
              .map(({ member }) => member.user?.name || member.user?.email || member.email)
              .join(", "),
            card.labels.map(({ label }) => label.name).join(", "),
            (customData?.meta as { starred?: boolean } | undefined)?.starred
              ? "Yes"
              : "",
            htmlToText(card.description),
            ...customColumns.map((column) => getCsvCustomValue(customData, column)),
            card.createdAt.toISOString().slice(0, 10),
            `${baseUrl}/cards/${card.publicId}`,
          ];
        }),
      );

      return {
        filename: `${board.name || "contacts"}-${toIsoDateInTimeZone(new Date(), timeZone)}.csv`,
        csv: toCsv([header, ...rows]),
      };
    }),

  /** Columns of the CSV import (from the pipeline's config), with the template. */
  importGuide: protectedProcedure
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const target = await getImportTarget(ctx.db, input.workspacePublicId);
      await assertPermission(ctx.db, userId, target.workspaceId, "workspace:view");

      const { labels } = await coraggioRepo.getImportContext(
        ctx.db,
        target.workspaceId,
        [target.main.id],
      );
      const config = parseConfigSafe(target.main.customFieldsConfig);

      return {
        columns: getContactImportGuide(config, {
          statuses: target.lists.map((list) => list.name),
          labels: labels.map((label) => label.name),
        }),
        template: buildContactImportTemplate(config),
        maxRows: CSV_IMPORT_MAX_ROWS,
      };
    }),

  /**
   * Creates contacts from a CSV in the export's format. All or nothing: if any
   * row has an error, nothing is imported and every error is returned.
   */
  importCsv: protectedProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        csv: z.string().max(5_000_000),
        // The importer's IANA time zone, for follow-up dates (local midnight)
        timeZone: z.string().max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const target = await getImportTarget(ctx.db, input.workspacePublicId);
      await assertPermission(ctx.db, userId, target.workspaceId, "card:create");

      const context = await coraggioRepo.getImportContext(
        ctx.db,
        target.workspaceId,
        [...new Set(target.lists.map((list) => list.boardId))],
      );
      const { contacts, errors, ignoredColumns } = validateContactImport(
        parseConfigSafe(target.main.customFieldsConfig),
        parseCsv(input.csv),
        { ...context, lists: target.lists },
      );

      if (errors.length) {
        return {
          imported: 0,
          errorCount: errors.length,
          errors: errors.slice(0, MAX_IMPORT_ERRORS),
          ignoredColumns,
        };
      }

      const timeZone = isValidTimeZone(input.timeZone)
        ? input.timeZone
        : getReminderTimeZone();
      const imported = await coraggioRepo.importContacts(ctx.db, {
        workspaceId: target.workspaceId,
        userId,
        contacts: contacts.map(({ row: _row, dueDate, ...contact }) => ({
          ...contact,
          dueDate: dueDate ? zonedMidnightToUtc(dueDate, timeZone) : null,
        })),
      });

      return { imported, errorCount: 0, errors: [], ignoredColumns };
    }),
});

const MAX_IMPORT_ERRORS = 500;

/**
 * The diocese's pipeline (whose config defines the columns) and the statuses an
 * import can use: the pipeline's, then the archive's.
 */
async function getImportTarget(db: dbClient, workspacePublicId: string) {
  const workspace = await workspaceRepo.getByPublicId(db, workspacePublicId);
  if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

  const { main, archive } = splitMainAndArchiveBoards(
    await coraggioRepo.getWorkspaceBoardsWithLists(db, workspace.id),
  );
  if (!main) {
    throw new TRPCError({ code: "NOT_FOUND", message: "The diocese has no pipeline board" });
  }
  const board = await coraggioRepo.getBoardForExport(db, main.publicId);

  return {
    workspaceId: workspace.id,
    main: { id: main.id, customFieldsConfig: board?.customFieldsConfig ?? null },
    lists: [main, archive].flatMap((b) =>
      b ? b.lists.map((list) => ({ id: list.id, name: list.name, boardId: b.id })) : [],
    ),
  };
}

/** First customData string value containing the query, to show why a result matched. */
function findMatchedValue(customData: unknown, query: string): string | null {
  const needle = query.toLowerCase();
  const stack: unknown[] = [customData];
  while (stack.length) {
    const value = stack.pop();
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value);
      if (text.toLowerCase().includes(needle)) return text.slice(0, 120);
    } else if (value && typeof value === "object") {
      stack.push(...Object.values(value));
    }
  }
  return null;
}
