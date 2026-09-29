import { t } from "@lingui/core/macro";
import { HiOutlineArrowDownTray } from "react-icons/hi2";

import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

/** Board menu item that downloads all contacts on the board as a CSV file. */
export function useExportContactsItem(boardPublicId: string) {
  const utils = api.useUtils();
  const { showPopup } = usePopup();

  const exportCsv = async () => {
    try {
      const { csv, filename } = await utils.coraggio.contacts.exportCsv.fetch({
        boardPublicId,
      });
      // Prefix a BOM so Excel detects UTF-8
      const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showPopup({
        header: t`Unable to export contacts`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    }
  };

  return {
    label: t`Export contacts (CSV)`,
    action: () => void exportCsv(),
    icon: (
      <HiOutlineArrowDownTray className="h-[16px] w-[16px] text-primary group-hover:text-secondary" />
    ),
  };
}
