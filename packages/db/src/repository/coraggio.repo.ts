// Coraggio fork-owned queries. Kept in a separate file to avoid upstream merge conflicts.
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  boards,
  cards,
  coraggioUserSettings,
  lists,
  notifications,
  workspaceMembers,
  workspaces,
} from "@kan/db/schema";

/* ---------------------------------------------------------------- settings */

export const getUserSettings = async (db: dbClient, userId: string) => {
  const row = await db.query.coraggioUserSettings.findFirst({
    where: eq(coraggioUserSettings.userId, userId),
  });

  return {
    emailNotificationsEnabled: row?.emailNotificationsEnabled ?? true,
  };
};

export const upsertUserSettings = async (
  db: dbClient,
  userId: string,
  settings: { emailNotificationsEnabled: boolean },
) => {
  await db
    .insert(coraggioUserSettings)
    .values({ userId, ...settings })
    .onConflictDoUpdate({
      target: coraggioUserSettings.userId,
      set: { ...settings, updatedAt: new Date() },
    });

  return getUserSettings(db, userId);
};

/** Returns the subset of userIds that have opted out of automated emails. */
export const getEmailOptedOutUserIds = async (
  db: dbClient,
  userIds: string[],
) => {
  if (userIds.length === 0) return new Set<string>();

  const rows = await db
    .select({ userId: coraggioUserSettings.userId })
    .from(coraggioUserSettings)
    .where(
      and(
        inArray(coraggioUserSettings.userId, userIds),
        eq(coraggioUserSettings.emailNotificationsEnabled, false),
      ),
    );

  return new Set(rows.map((row) => row.userId));
};

/* -------------------------------------------------------------------- star */

/** Sets customData.meta.starred server-side so other customData edits aren't clobbered. */
export const setCardStarred = async (
  db: dbClient,
  cardId: number,
  starred: boolean,
) => {
  const [result] = await db
    .update(cards)
    .set({
      customData: sql`jsonb_set(
        jsonb_set(coalesce(${cards.customData}, '{}'::jsonb), '{meta}', coalesce(${cards.customData}->'meta', '{}'::jsonb)),
        '{meta,starred}',
        ${starred ? sql`'true'::jsonb` : sql`'false'::jsonb`}
      )`,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, cardId))
    .returning({ publicId: cards.publicId, customData: cards.customData });

  return result;
};

/* ------------------------------------------------------------------ search */

export const searchContacts = async (
  db: dbClient,
  workspaceId: number,
  query: string,
  limit = 15,
) => {
  const pattern = `%${query}%`;

  return db
    .select({
      publicId: cards.publicId,
      title: cards.title,
      customData: cards.customData,
      dueDate: cards.dueDate,
      listName: lists.name,
      boardPublicId: boards.publicId,
      boardName: boards.name,
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(
      and(
        eq(boards.workspaceId, workspaceId),
        eq(boards.type, "regular"),
        eq(boards.isArchived, false),
        isNull(cards.deletedAt),
        isNull(lists.deletedAt),
        isNull(boards.deletedAt),
        or(
          ilike(cards.title, pattern),
          sql`similarity(${cards.title}, ${query}) > 0.2`,
          sql`${cards.customData}::text ILIKE ${pattern}`,
        ),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${cards.title} ILIKE ${pattern} THEN 0 ELSE 1 END`,
      sql`similarity(${cards.title}, ${query}) DESC`,
      asc(cards.title),
    )
    .limit(limit);
};

/* -------------------------------------------------------------- assignment */

/** Active workspace members (with their user account) for the given member ids. */
export const getActiveMembersWithUsers = async (
  db: dbClient,
  workspaceMemberIds: number[],
) => {
  if (workspaceMemberIds.length === 0) return [];

  return db.query.workspaceMembers.findMany({
    columns: { id: true, email: true },
    where: and(
      inArray(workspaceMembers.id, workspaceMemberIds),
      eq(workspaceMembers.status, "active"),
      isNull(workspaceMembers.deletedAt),
    ),
    with: { user: { columns: { id: true, email: true, name: true } } },
  });
};

/* --------------------------------------------------------------- reminders */

/**
 * Cards whose follow-up (due) date falls on `date` (YYYY-MM-DD) in `timeZone`,
 * with their active, assigned members.
 */
export const getCardsDueOn = async (
  db: dbClient,
  date: string,
  timeZone: string,
) => {
  const result = await db.execute(sql`
    SELECT
      c.id AS "cardId",
      c."publicId" AS "cardPublicId",
      c.title AS "cardTitle",
      c."dueDate" AS "dueDate",
      c."customData" AS "customData",
      b.name AS "boardName",
      b."workspaceId" AS "workspaceId",
      u.id AS "userId",
      u.email AS "email",
      u.name AS "userName"
    FROM card c
    JOIN list l ON l.id = c."listId" AND l."deletedAt" IS NULL
    JOIN board b ON b.id = l."boardId" AND b."deletedAt" IS NULL
      AND b.type = 'regular' AND b."isArchived" = false
    JOIN _card_workspace_members cwm ON cwm."cardId" = c.id
    JOIN workspace_members wm ON wm.id = cwm."workspaceMemberId"
      AND wm."deletedAt" IS NULL AND wm.status = 'active'
    JOIN "user" u ON u.id = wm."userId"
    WHERE c."deletedAt" IS NULL
      AND c."dueDate" IS NOT NULL
      AND ((c."dueDate" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date = ${date}::date
    ORDER BY u.id, c.title
  `);

  return result.rows as {
    cardId: number;
    cardPublicId: string;
    cardTitle: string;
    dueDate: string;
    customData: Record<string, unknown> | null;
    boardName: string;
    workspaceId: number;
    userId: string;
    email: string;
    userName: string | null;
  }[];
};

/** Whether a follow-up reminder for this user/card/date was already recorded. */
export const dueReminderExists = async (
  db: dbClient,
  args: { userId: string; cardId: number; date: string },
) => {
  const row = await db.query.notifications.findFirst({
    columns: { id: true },
    where: and(
      eq(notifications.userId, args.userId),
      eq(notifications.cardId, args.cardId),
      eq(notifications.type, "card.due_reminder"),
      eq(notifications.metadata, JSON.stringify({ date: args.date })),
    ),
  });

  return !!row;
};

/* ------------------------------------------------------------------ export */

export const getBoardForExport = (db: dbClient, boardPublicId: string) => {
  return db.query.boards.findFirst({
    columns: {
      id: true,
      name: true,
      workspaceId: true,
      customFieldsConfig: true,
    },
    where: and(eq(boards.publicId, boardPublicId), isNull(boards.deletedAt)),
  });
};

export const getBoardContactsForExport = async (
  db: dbClient,
  boardId: number,
) => {
  return db.query.lists.findMany({
    columns: { name: true, index: true },
    where: and(eq(lists.boardId, boardId), isNull(lists.deletedAt)),
    orderBy: asc(lists.index),
    with: {
      cards: {
        columns: {
          publicId: true,
          title: true,
          description: true,
          dueDate: true,
          customData: true,
          createdAt: true,
          index: true,
        },
        where: isNull(cards.deletedAt),
        orderBy: asc(cards.index),
        with: {
          labels: {
            with: { label: { columns: { name: true } } },
          },
          members: {
            with: {
              member: {
                columns: { email: true },
                with: { user: { columns: { name: true, email: true } } },
              },
            },
          },
        },
      },
    },
  });
};

/* ------------------------------------------------------------------- admin */

export const listAllWorkspaces = async (db: dbClient) => {
  return db.query.workspaces.findMany({
    columns: { publicId: true, name: true, slug: true, createdAt: true },
    where: isNull(workspaces.deletedAt),
    orderBy: desc(workspaces.createdAt),
    with: {
      members: {
        columns: { email: true, role: true, status: true },
        where: isNull(workspaceMembers.deletedAt),
      },
      boards: {
        columns: { publicId: true, name: true, type: true },
        where: and(isNull(boards.deletedAt), eq(boards.isArchived, false)),
      },
    },
  });
};

export const getWorkspaceMemberEmails = async (
  db: dbClient,
  workspaceId: number,
) => {
  const rows = await db
    .select({ email: workspaceMembers.email })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        isNull(workspaceMembers.deletedAt),
      ),
    );
  return new Set(rows.map((row) => row.email.toLowerCase()));
};

export const listTemplateBoards = async (db: dbClient) => {
  return db
    .select({
      publicId: boards.publicId,
      name: boards.name,
      workspaceName: workspaces.name,
    })
    .from(boards)
    .innerJoin(workspaces, eq(boards.workspaceId, workspaces.id))
    .where(
      and(
        eq(boards.type, "template"),
        isNull(boards.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .orderBy(asc(boards.name));
};
