import { t } from "@lingui/core/macro";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import { CORAGGIO_FEEDBACK_FORM_URL } from "@kan/shared";

/** Sidebar link to the beta feedback form, in a new tab so the board stays open. */
export default function SidebarFeedbackLink({
  isCollapsed = false,
}: {
  isCollapsed?: boolean;
}) {
  const name = t`Beta Feedback`;

  return (
    <li className="sidebar-nav-item sidebar-nav-item-feedback">
      <a
        href={CORAGGIO_FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={isCollapsed ? name : undefined}
        className={twMerge(
          "sidebar-nav-link sidebar-nav-link-feedback group flex h-[34px] w-full items-center rounded-md p-1.5 text-sm font-normal leading-6 text-neutral-600 hover:bg-light-200 hover:text-light-1000 dark:text-dark-900 dark:hover:bg-dark-200 dark:hover:text-dark-1000",
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
            <HiOutlineChatBubbleLeftRight className="h-[18px] w-[18px] text-light-1000 dark:text-dark-1000" />
          </div>
          <span className={twMerge(isCollapsed && "md:hidden")}>{name}</span>
        </div>
      </a>
    </li>
  );
}
