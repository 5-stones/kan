import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as cardRepo from "@kan/db/repository/card.repo";
import * as coraggioRepo from "@kan/db/repository/coraggio.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";
import {
  getCsvCustomColumns,
  getCsvCustomValue,
  getFollowUpTask,
  parseCustomFieldsConfig,
  toCsv,
} from "@kan/shared";
import type { CustomFieldsConfig } from "@kan/shared";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  getReminderTimeZone,
  toIsoDateInTimeZone,
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
      const customColumns = getCsvCustomColumns(config).filter(
        // The follow-up task already has its own fixed column
        (column) =>
          !(column.sectionKey === "sidebar" && column.fieldKey === "followUpTask"),
      );
      const sidebarTitles = config.sidebar?.fields ?? {};
      const title = (key: string, fallback: string) =>
        (sidebarTitles[key] as { title?: string } | undefined)?.title ?? fallback;
      const timeZone = getReminderTimeZone();

      const header = [
        config.main?.fields?.title?.title ?? "Name",
        title("list", "Status"),
        title("dueDate", "Follow-up Date"),
        "Follow-up Task",
        title("members", "Assigned To"),
        title("labels", "Labels"),
        "Starred",
        config.main?.fields?.description?.title ?? "Notes",
        ...customColumns.map((column) => column.header),
        "Created",
        "Link",
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
});

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
