import { t } from "@lingui/core/macro";
import { HiOutlineStar, HiStar } from "react-icons/hi2";

import { isCardStarred } from "@kan/shared";

import { useToggleStar } from "./useToggleStar";

/** Star button shown in the top-right corner of the contact detail sidebar. */
export function StarToggle({
  cardPublicId,
  customData,
  disabled,
}: {
  cardPublicId: string;
  customData: unknown;
  disabled?: boolean;
}) {
  const starred = isCardStarred(customData as Record<string, unknown> | null);
  const { setStarred } = useToggleStar();
  const label = starred ? t`Unstar contact` : t`Star contact`;

  return (
    <button
      type="button"
      className={`card-star-toggle absolute right-6 top-6 rounded-full p-1 transition-colors disabled:cursor-default ${
        starred
          ? "card-star-toggle-active text-yellow-400"
          : "text-textMuted hover:text-yellow-400 dark:text-textMutedDark"
      }`}
      onClick={() => setStarred(cardPublicId, !starred)}
      disabled={disabled || !cardPublicId}
      aria-pressed={starred}
      aria-label={label}
      title={label}
    >
      {starred ? (
        <HiStar className="h-7 w-7" />
      ) : (
        <HiOutlineStar className="h-7 w-7" />
      )}
    </button>
  );
}
