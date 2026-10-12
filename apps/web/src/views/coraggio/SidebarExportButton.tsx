import { t } from "@lingui/core/macro";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import { useBoardsNav } from "./useBoardsNav";
import { useExportContactsItem } from "./useExportContactsItem";

/** Sidebar action that downloads the pipeline board's contacts as CSV. */
export default function SidebarExportButton({
  isCollapsed = false,
}: {
  isCollapsed?: boolean;
}) {
  const { main } = useBoardsNav();
  const exportItem = useExportContactsItem(main?.publicId ?? "");
  if (!main) return null;

  const name = t`Export contacts`;

  return (
    <li className="sidebar-nav-item sidebar-nav-item-export">
      <button
        type="button"
        onClick={exportItem.action}
        title={isCollapsed ? name : undefined}
        className={twMerge(
          "sidebar-nav-link sidebar-nav-link-export group flex h-[34px] w-full items-center rounded-md p-1.5 text-sm font-normal leading-6 text-neutral-600 hover:bg-light-200 hover:text-light-1000 dark:text-dark-900 dark:hover:bg-dark-200 dark:hover:text-dark-1000",
          isCollapsed ? "md:justify-center" : "justify-between",
        )}
      >
        <div
          className={twMerge(
            "flex items-center",
            isCollapsed
              ? "justify-start gap-x-3 md:justify-center md:gap-x-0"
              : "gap-x-3",
          )}
        >
          <div className="flex w-5 items-center justify-center">
            <HiOutlineArrowDownTray className="h-[18px] w-[18px] text-light-1000 dark:text-dark-1000" />
          </div>
          <span className={twMerge(isCollapsed && "md:hidden")}>{name}</span>
        </div>
      </button>
    </li>
  );
}
