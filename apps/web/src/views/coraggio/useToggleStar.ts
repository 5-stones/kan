import { t } from "@lingui/core/macro";

import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

/** Star/unstar a contact (shared across the board), with an optimistic card update. */
export function useToggleStar() {
  const utils = api.useUtils();
  const { showPopup } = usePopup();

  const mutation = api.coraggio.contacts.setStarred.useMutation({
    onMutate: async ({ cardPublicId, starred }) => {
      await utils.card.byId.cancel({ cardPublicId });
      const previousCard = utils.card.byId.getData({ cardPublicId });

      utils.card.byId.setData({ cardPublicId }, (oldCard) => {
        if (!oldCard) return oldCard;
        const customData = (oldCard.customData ?? {}) as Record<string, unknown>;
        const meta = (customData.meta ?? {}) as Record<string, unknown>;
        return { ...oldCard, customData: { ...customData, meta: { ...meta, starred } } };
      });

      return { previousCard };
    },
    onError: (_error, { cardPublicId }, context) => {
      utils.card.byId.setData({ cardPublicId }, context?.previousCard);
      showPopup({
        header: t`Unable to update star`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async (_data, _error, { cardPublicId }) => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
    },
  });

  return {
    setStarred: (cardPublicId: string, starred: boolean) =>
      mutation.mutate({ cardPublicId, starred }),
    isPending: mutation.isPending,
  };
}
