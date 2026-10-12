import type { DropResult } from "react-beautiful-dnd";
import { useCallback, useEffect, useState } from "react";

import { getCustomDataValue } from "@kan/shared";

export const boardSortKeys = ["alphabetical", "followUp", "lastContact"] as const;
export type BoardSortKey = (typeof boardSortKeys)[number];

interface SortableCard {
  title?: string;
  dueDate?: Date | null;
  customData?: unknown;
}

const storageKey = (boardPublicId: string) => `coraggio:boardSort:${boardPublicId}`;
/** before the sort menu, only "sort by follow-up" existed ("1" = on) */
const legacyStorageKey = (boardPublicId: string) =>
  `coraggio:followUpSort:${boardPublicId}`;

function readStored(boardPublicId: string): BoardSortKey | null {
  try {
    const stored = window.localStorage.getItem(storageKey(boardPublicId));
    if (stored !== null) {
      return (boardSortKeys as readonly string[]).includes(stored)
        ? (stored as BoardSortKey)
        : null;
    }
    return window.localStorage.getItem(legacyStorageKey(boardPublicId)) === "1"
      ? "followUp"
      : null;
  } catch {
    return null;
  }
}

function toTime(value: unknown): number | null {
  if (!value) return null;
  const time = new Date(value as string | Date).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Stable sort by a nullable key: cards without a value keep their manual order
 * at the end.
 */
function sortByKey<T, K extends number | string>(
  cards: T[],
  getKey: (card: T) => K | null,
  compare: (a: K, b: K) => number,
): T[] {
  return cards
    .map((card, position) => ({ card, position, key: getKey(card) }))
    .sort((a, b) => {
      if (a.key !== null && b.key !== null) {
        const result = compare(a.key, b.key);
        if (result !== 0) return result;
      }
      if (a.key === null && b.key !== null) return 1;
      if (a.key !== null && b.key === null) return -1;
      return a.position - b.position;
    })
    .map(({ card }) => card);
}

/** Soonest follow-up date first. */
export function sortByFollowUp<T extends SortableCard>(cards: T[]): T[] {
  return sortByKey(cards, (card) => toTime(card.dueDate), (a, b) => a - b);
}

/** A to Z by name. */
export function sortAlphabetically<T extends SortableCard>(cards: T[]): T[] {
  return sortByKey(
    cards,
    (card) => card.title?.trim() || null,
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );
}

/** Longest since last contact first, so the contacts who need attention lead. */
export function sortByLastContact<T extends SortableCard>(cards: T[]): T[] {
  return sortByKey(
    cards,
    (card) =>
      toTime(
        getCustomDataValue(
          card.customData as Record<string, unknown> | null | undefined,
          "sidebar",
          "lastContacted",
        ),
      ),
    (a, b) => a - b,
  );
}

export function sortCardsBy<T extends SortableCard>(
  cards: T[],
  sortKey: BoardSortKey | null,
): T[] {
  switch (sortKey) {
    case "alphabetical":
      return sortAlphabetically(cards);
    case "followUp":
      return sortByFollowUp(cards);
    case "lastContact":
      return sortByLastContact(cards);
    default:
      return cards;
  }
}

/**
 * Board-level sort (a view only, remembered per board in this browser). The stored
 * manual order is never changed, so turning sorting off brings it back. While sorted,
 * cards can still move between columns (a status change) but can't be reordered
 * within a column, since the displayed order no longer matches the stored order.
 */
export function useBoardSort(boardPublicId: string | null | undefined) {
  const [sortKey, setSortKeyState] = useState<BoardSortKey | null>(null);

  useEffect(() => {
    if (boardPublicId) setSortKeyState(readStored(boardPublicId));
  }, [boardPublicId]);

  const setSortKey = useCallback(
    (next: BoardSortKey | null) => {
      setSortKeyState(next);
      try {
        if (boardPublicId) {
          window.localStorage.setItem(storageKey(boardPublicId), next ?? "");
          window.localStorage.removeItem(legacyStorageKey(boardPublicId));
        }
      } catch {
        // storage unavailable; keep the in-memory value
      }
    },
    [boardPublicId],
  );

  const sortCards = useCallback(
    <T extends SortableCard>(cards: T[]) => sortCardsBy(cards, sortKey),
    [sortKey],
  );

  /**
   * Adjusts a card drop while sorting: same-column drops are ignored (returns null),
   * cross-column drops are appended to the end of the destination column.
   */
  const adjustCardDrop = useCallback(
    (
      { source, destination }: Pick<DropResult, "source" | "destination">,
      destinationCardCount: number,
    ): number | null => {
      if (!sortKey || !destination) return destination?.index ?? null;
      if (source.droppableId === destination.droppableId) return null;
      return destinationCardCount;
    },
    [sortKey],
  );

  return { sortKey, setSortKey, sortCards, adjustCardDrop };
}
