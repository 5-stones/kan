import { t } from "@lingui/core/macro";

import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

/** Moves a contact to a status on the pipeline or archive board, then refreshes the board. */
export function useMoveContactToBoard(onSuccess?: () => void) {
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  return api.coraggio.contacts.moveToBoard.useMutation({
    onSuccess: async () => {
      onSuccess?.();
      await utils.board.byId.invalidate();
    },
    onError: () =>
      showPopup({
        header: t`Unable to move contact`,
        message: t`Please try again.`,
        icon: "error",
      }),
  });
}
