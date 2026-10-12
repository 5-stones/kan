import { CORAGGIO_ARCHIVE_BOARD_SLUG } from "@kan/shared";

/**
 * A diocese has one main board (the pipeline, the oldest regular board) and
 * optionally an archive board (slug "archive"). Expects boards oldest first.
 */
export function splitMainAndArchiveBoards<T extends { slug: string }>(
  boards: T[],
): { main: T | null; archive: T | null } {
  return {
    main: boards.find((board) => board.slug !== CORAGGIO_ARCHIVE_BOARD_SLUG) ?? null,
    archive:
      boards.find((board) => board.slug === CORAGGIO_ARCHIVE_BOARD_SLUG) ?? null,
  };
}
