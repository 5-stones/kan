// Coraggio fork-owned queries. Kept in a separate file to avoid upstream merge conflicts.
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  boards,
  cardActivities,
  cards,
  cardsToLabels,
  cardToWorkspaceMembers,
  coraggioUserSettings,
  labels,
  lists,
  notifications,
  workspaceMembers,
  workspaces,
} from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

/* ---------------------------------------------------------------- settings */

export const getUserSettings = async (db: dbClient, userId: string) => {
  const row = await db.query.coraggioUserSettings.findFirst({
    where: eq(coraggioUserSettings.userId, userId),
  });

  return {
    emailNotificationsEnabled: row?.emailNotificationsEnabled ?? true,
    timeZone: row?.timeZone ?? null,
  };
};

export const upsertUserSettings = async (
  db: dbClient,
  userId: string,
  settings: { emailNotificationsEnabled?: boolean; timeZone?: string | null },
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

/** Whether Postgres knows the time zone (the reminder query converts dates with it). */
export const isKnownTimeZone = async (db: dbClient, timeZone: string) => {
  const result = await db.execute(
    sql`SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${timeZone}) AS "known"`,
  );
  return (result.rows[0] as { known: boolean } | undefined)?.known === true;
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

/** Saved digest time zones by user id (users without one are left out). */
export const getUserTimeZones = async (db: dbClient, userIds: string[]) => {
  if (userIds.length === 0) return new Map<string, string>();

  const rows = await db
    .select({
      userId: coraggioUserSettings.userId,
      timeZone: coraggioUserSettings.timeZone,
    })
    .from(coraggioUserSettings)
    .where(inArray(coraggioUserSettings.userId, userIds));

  const timeZones = new Map<string, string>();
  for (const row of rows) {
    if (row.timeZone) timeZones.set(row.userId, row.timeZone);
  }
  return timeZones;
};

/** Title, follow-up date and customData for notification emails. */
export const getCardForEmail = (db: dbClient, cardPublicId: string) =>
  db.query.cards.findFirst({
    columns: { title: true, dueDate: true, customData: true },
    where: and(eq(cards.publicId, cardPublicId), isNull(cards.deletedAt)),
  });

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
  // Fuzzy title matching catches typos ("smyth" → Smith, ~0.33) without
  // unrelated near-misses ("message" → Messy Owl, ~0.29).
  const similarityThreshold = 0.3;

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
          sql`similarity(${cards.title}, ${query}) > ${similarityThreshold}`,
          sql`${cards.customData}::text ILIKE ${pattern}`,
        ),
      ),
    )
    .orderBy(
      // exact title hits, then exact field hits, then fuzzy-only title hits
      sql`CASE
        WHEN ${cards.title} ILIKE ${pattern} THEN 0
        WHEN ${cards.customData}::text ILIKE ${pattern} THEN 1
        ELSE 2
      END`,
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
 * Follow-up reminder candidates: each active assignee (who hasn't opted out)
 * of a contact whose follow-up date is between `maxDaysOverdue` days ago and
 * today, in the assignee's time zone, once it's past `fromHour` there.
 * Due dates are stored as the UTC instant of local midnight where they were set.
 */
export const getFollowUpReminderCandidates = async (
  db: dbClient,
  args: {
    now: Date;
    defaultTimeZone: string;
    fromHour: number;
    maxDaysOverdue: number;
  },
) => {
  const now = args.now.toISOString();
  const result = await db.execute(sql`
    WITH candidates AS (
      SELECT
        c.id AS "cardId",
        c."publicId" AS "cardPublicId",
        c.title AS "cardTitle",
        c."customData" AS "customData",
        b."publicId" AS "boardPublicId",
        b."workspaceId" AS "workspaceId",
        wm."publicId" AS "memberPublicId",
        u.id AS "userId",
        u.email AS "email",
        u.name AS "userName",
        ((c."dueDate" AT TIME ZONE 'UTC') AT TIME ZONE tz.zone)::date AS due_on,
        (${now}::timestamptz AT TIME ZONE tz.zone)::date AS today,
        extract(hour FROM ${now}::timestamptz AT TIME ZONE tz.zone)::int AS local_hour
      FROM card c
      JOIN list l ON l.id = c."listId" AND l."deletedAt" IS NULL
      JOIN board b ON b.id = l."boardId" AND b."deletedAt" IS NULL
        AND b.type = 'regular' AND b."isArchived" = false
      JOIN _card_workspace_members cwm ON cwm."cardId" = c.id
      JOIN workspace_members wm ON wm.id = cwm."workspaceMemberId"
        AND wm."deletedAt" IS NULL AND wm.status = 'active'
      JOIN "user" u ON u.id = wm."userId"
      LEFT JOIN coraggio_user_settings s ON s."userId" = u.id
      CROSS JOIN LATERAL (SELECT COALESCE(s."timeZone", ${args.defaultTimeZone}) AS zone) tz
      WHERE c."deletedAt" IS NULL
        AND COALESCE(s."emailNotificationsEnabled", true)
        -- index-friendly prefilter; the exact window is applied per time zone below
        AND c."dueDate" BETWEEN ${now}::timestamptz - make_interval(days => ${args.maxDaysOverdue + 2})
          AND ${now}::timestamptz + interval '2 days'
    )
    SELECT
      "cardId", "cardPublicId", "cardTitle", "customData", "boardPublicId",
      "workspaceId", "memberPublicId", "userId", "email", "userName",
      to_char(due_on, 'YYYY-MM-DD') AS "dueOn",
      to_char(today, 'YYYY-MM-DD') AS "today",
      (today - due_on) AS "daysOverdue"
    FROM candidates
    WHERE local_hour >= ${args.fromHour}
      AND due_on BETWEEN today - ${args.maxDaysOverdue}::int AND today
    ORDER BY "userId", "cardTitle"
  `);

  return result.rows as {
    cardId: number;
    cardPublicId: string;
    cardTitle: string;
    customData: Record<string, unknown> | null;
    boardPublicId: string;
    workspaceId: number;
    memberPublicId: string;
    userId: string;
    email: string;
    userName: string | null;
    dueOn: string;
    today: string;
    daysOverdue: number;
  }[];
};

/**
 * Follow-up reminders already sent to these users, as
 * `${type}:${userId}:${cardId}:${metadata}` keys.
 */
export const getSentFollowUpReminderKeys = async (
  db: dbClient,
  userIds: string[],
) => {
  if (userIds.length === 0) return new Set<string>();

  const rows = await db
    .select({
      type: notifications.type,
      userId: notifications.userId,
      cardId: notifications.cardId,
      metadata: notifications.metadata,
    })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userId, userIds),
        inArray(notifications.type, ["card.due_reminder", "card.overdue_reminder"]),
        sql`${notifications.createdAt} > now() - interval '30 days'`,
      ),
    );

  return new Set(
    rows.map(
      (row) => `${row.type}:${row.userId}:${row.cardId}:${row.metadata}`,
    ),
  );
};

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

/* ------------------------------------------------------------------ import */

/** Labels, assignable members and existing contact names for validating a CSV import. */
export const getImportContext = async (
  db: dbClient,
  workspaceId: number,
  boardIds: number[],
) => {
  const [boardLabels, members, existing] = await Promise.all([
    boardIds.length
      ? db
          .select({ id: labels.id, name: labels.name, boardId: labels.boardId })
          .from(labels)
          .where(and(inArray(labels.boardId, boardIds), isNull(labels.deletedAt)))
      : [],
    db.query.workspaceMembers.findMany({
      columns: { id: true, email: true },
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        inArray(workspaceMembers.status, ["active", "invited"]),
        isNull(workspaceMembers.deletedAt),
      ),
      with: { user: { columns: { name: true, email: true } } },
    }),
    db
      .selectDistinct({ name: sql<string>`lower(trim(${cards.title}))` })
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
        ),
      ),
  ]);

  return {
    labels: boardLabels,
    members: members.map((member) => ({
      id: member.id,
      name: member.user?.name ?? null,
      email: member.user?.email ?? member.email,
    })),
    existingNames: new Set(existing.map((row) => row.name)),
  };
};

/**
 * Creates the imported contacts in one transaction, appended to their lists, with
 * their labels, assignees and a "card.created" activity each. Like cardRepo.create,
 * but in bulk. Sends no emails or webhooks.
 */
export const importContacts = async (
  db: dbClient,
  args: {
    workspaceId: number;
    userId: string;
    contacts: {
      title: string;
      description: string;
      listId: number;
      dueDate: Date | null;
      customData: Record<string, unknown> | null;
      labelIds: number[];
      memberIds: number[];
    }[];
  },
) => {
  const { contacts } = args;
  if (contacts.length === 0) return 0;

  return db.transaction(async (tx) => {
    const [counter] = await tx
      .update(workspaces)
      .set({ cardCounter: sql`${workspaces.cardCounter} + ${contacts.length}` })
      .where(eq(workspaces.id, args.workspaceId))
      .returning({ cardCounter: workspaces.cardCounter });
    if (!counter) throw new Error(`Workspace ${args.workspaceId} not found`);
    let cardNumber = counter.cardCounter - contacts.length;

    const listIds = [...new Set(contacts.map((contact) => contact.listId))];
    const maxIndexes = await tx
      .select({ listId: cards.listId, maxIndex: sql<number>`max(${cards.index})` })
      .from(cards)
      .where(and(inArray(cards.listId, listIds), isNull(cards.deletedAt)))
      .groupBy(cards.listId);
    const nextIndex = new Map(listIds.map((id) => [id, 0]));
    for (const { listId, maxIndex } of maxIndexes) {
      nextIndex.set(listId, Number(maxIndex) + 1);
    }

    const values = contacts.map((contact) => {
      const index = nextIndex.get(contact.listId) ?? 0;
      nextIndex.set(contact.listId, index + 1);
      return {
        publicId: generateUID(),
        title: contact.title,
        description: contact.description,
        createdBy: args.userId,
        listId: contact.listId,
        index,
        cardNumber: ++cardNumber,
        dueDate: contact.dueDate,
        customData: contact.customData,
      };
    });

    const inserted = await tx
      .insert(cards)
      .values(values)
      .returning({ id: cards.id, publicId: cards.publicId });
    const idByPublicId = new Map(inserted.map((card) => [card.publicId, card.id]));
    const cardIds = values.map((value) => {
      const id = idByPublicId.get(value.publicId);
      if (id === undefined) throw new Error("Unable to create card");
      return id;
    });
    const rowsFor = <T>(each: (contact: (typeof contacts)[number], cardId: number) => T[]) =>
      contacts.flatMap((contact, i) => each(contact, cardIds[i] ?? 0));

    const labelRows = rowsFor((contact, cardId) =>
      contact.labelIds.map((labelId) => ({ cardId, labelId })),
    );
    if (labelRows.length) await tx.insert(cardsToLabels).values(labelRows);

    const memberRows = rowsFor((contact, cardId) =>
      contact.memberIds.map((workspaceMemberId) => ({ cardId, workspaceMemberId })),
    );
    if (memberRows.length) await tx.insert(cardToWorkspaceMembers).values(memberRows);

    await tx.insert(cardActivities).values(
      cardIds.map((cardId) => ({
        publicId: generateUID(),
        cardId,
        type: "card.created" as const,
        createdBy: args.userId,
      })),
    );

    return inserted.length;
  });
};

/* ------------------------------------------------------------------ boards */

/**
 * Regular, unarchived boards of a workspace (oldest first) with their lists.
 * Used to find the diocese's main board and its archive board.
 */
export const getWorkspaceBoardsWithLists = (db: dbClient, workspaceId: number) => {
  return db.query.boards.findMany({
    columns: { id: true, publicId: true, name: true, slug: true },
    where: and(
      eq(boards.workspaceId, workspaceId),
      eq(boards.type, "regular"),
      eq(boards.isArchived, false),
      isNull(boards.deletedAt),
    ),
    orderBy: asc(boards.id),
    with: {
      lists: {
        columns: { id: true, publicId: true, name: true, index: true },
        where: isNull(lists.deletedAt),
        orderBy: asc(lists.index),
      },
    },
  });
};

/**
 * Points a card's labels at the same-named labels of another board (labels are
 * per board), dropping any the target board doesn't have.
 */
export const relinkCardLabelsToBoard = async (
  db: dbClient,
  cardId: number,
  boardId: number,
) => {
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ name: labels.name })
      .from(cardsToLabels)
      .innerJoin(labels, eq(cardsToLabels.labelId, labels.id))
      .where(eq(cardsToLabels.cardId, cardId));
    if (current.length === 0) return;

    const targets = await tx
      .select({ id: labels.id, name: labels.name })
      .from(labels)
      .where(and(eq(labels.boardId, boardId), isNull(labels.deletedAt)));
    const idByName = new Map(
      targets.map((label) => [label.name.toLowerCase(), label.id]),
    );
    const labelIds = [
      ...new Set(
        current
          .map((label) => idByName.get(label.name.toLowerCase()))
          .filter((id): id is number => id !== undefined),
      ),
    ];

    await tx.delete(cardsToLabels).where(eq(cardsToLabels.cardId, cardId));
    if (labelIds.length > 0) {
      await tx
        .insert(cardsToLabels)
        .values(labelIds.map((labelId) => ({ cardId, labelId })));
    }
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
