import { t } from "@lingui/core/macro";

import { useModal } from "~/providers/modal";
import { useMoveContactToBoard } from "./useMoveContactToBoard";

/**
 * Moves a contact to a status on the other board: from the pipeline into the
 * archive (seminarians, non-candidates), or from the archive back to the pipeline.
 */
export function CardContextArchiveModal({
  title,
  lists,
}: {
  title: string;
  lists: { publicId: string; name: string }[];
}) {
  const { entityId: cardPublicId, closeModal } = useModal();
  const moveToBoard = useMoveContactToBoard(closeModal);

  if (!cardPublicId) return null;

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-semibold text-light-1000 dark:text-dark-1000">
        {title}
      </h2>
      <ul className="space-y-1">
        {lists.map((list) => (
          <li key={list.publicId}>
            <button
              type="button"
              disabled={moveToBoard.isPending}
              onClick={() =>
                moveToBoard.mutate({ cardPublicId, listPublicId: list.publicId })
              }
              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-light-200 disabled:opacity-50 dark:hover:bg-dark-400"
            >
              {list.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
