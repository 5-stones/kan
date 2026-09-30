import Link from "next/link";
import { t } from "@lingui/core/macro";
import { HiXMark } from "react-icons/hi2";

import type { RouterOutputs } from "~/utils/api";
import Dropdown from "../card/components/Dropdown";
import { StarToggle } from "./StarToggle";

type Card = NonNullable<RouterOutputs["card"]["byId"]>;

/**
 * Top-right of the contact detail sidebar: star, card menu, close.
 * On mobile the menu and close stay in the page header (the sidebar is a drawer there).
 */
export function CardPanelActions({
  cardPublicId,
  card,
  isTemplate,
  canEdit,
}: {
  cardPublicId: string;
  card: Card | undefined;
  isTemplate?: boolean;
  canEdit: boolean;
}) {
  const board = card?.list.board;
  const cardPrefix = board?.workspace.cardPrefix;

  return (
    <div className="card-detail-actions absolute right-6 top-6 z-10 flex items-center gap-1">
      {!isTemplate && (
        <StarToggle
          cardPublicId={cardPublicId}
          customData={card?.customData}
          disabled={!canEdit}
        />
      )}
      {card && (
        <div className="hidden items-center gap-1 md:flex">
          <Dropdown
            cardPublicId={cardPublicId}
            isTemplate={isTemplate}
            boardPublicId={board?.publicId}
            cardCreatedBy={card.createdBy}
            ticketNumber={
              card.cardNumber != null && cardPrefix
                ? `${cardPrefix}-${card.cardNumber}`
                : null
            }
            listPublicId={card.list.publicId}
            cardIndex={card.index}
          />
          <Link
            href={`/${isTemplate ? "templates" : "boards"}/${board?.publicId}`}
            className="card-detail-close flex h-7 w-7 items-center justify-center rounded-[5px] text-textMuted hover:bg-light-200 dark:text-textMutedDark dark:hover:bg-dark-200"
            aria-label={t`Close`}
          >
            <HiXMark className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
