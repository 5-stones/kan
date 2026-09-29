import type { DropResult } from "react-beautiful-dnd";
import { useCallback, useEffect, useState } from "react";

const storageKey = (boardPublicId: string) =>
  `coraggio:followUpSort:${boardPublicId}`;

function readStored(boardPublicId: string) {
  try {
    return window.localStorage.getItem(storageKey(boardPublicId)) === "1";
  } catch {
    return false;
  }
}

/** Soonest follow-up date first; contacts without one keep their manual order at the end. */
export function sortByFollowUp<T extends { dueDate?: Date | null; index?: number }>(
  cards: T[],
): T[] {
  return cards
    .map((card, position) => ({ card, position }))
    .sort((a, b) => {
      const aTime = a.card.dueDate ? new Date(a.card.dueDate).getTime() : null;
      const bTime = b.card.dueDate ? new Date(b.card.dueDate).getTime() : null;
      if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
      if (aTime === null && bTime !== null) return 1;
      if (aTime !== null && bTime === null) return -1;
      return a.position - b.position;
    })
    .map(({ card }) => card);
}

/**
 * Board-level "sort by follow-up date" view toggle, remembered per board in this browser.
 * While enabled, cards can still move between columns (a status change) but can't be
 * reordered within a column, since the displayed order no longer matches the stored order.
 */
export function useFollowUpSort(boardPublicId: string | null | undefined) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (boardPublicId) setEnabled(readStored(boardPublicId));
  }, [boardPublicId]);

  const toggle = useCallback(() => {
    setEnabled((previous) => {
      const next = !previous;
      try {
        if (boardPublicId)
          window.localStorage.setItem(storageKey(boardPublicId), next ? "1" : "0");
      } catch {
        // storage unavailable; keep the in-memory value
      }
      return next;
    });
  }, [boardPublicId]);

  const sortCards = useCallback(
    <T extends { dueDate?: Date | null; index?: number }>(cards: T[]) =>
      enabled ? sortByFollowUp(cards) : cards,
    [enabled],
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
      if (!enabled || !destination) return destination?.index ?? null;
      if (source.droppableId === destination.droppableId) return null;
      return destinationCardCount;
    },
    [enabled],
  );

  return { enabled, toggle, sortCards, adjustCardDrop };
}
