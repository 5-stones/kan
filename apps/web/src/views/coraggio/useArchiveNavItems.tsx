import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { HiOutlineFolder } from "react-icons/hi2";

import type { KeyboardShortcut } from "~/providers/keyboard-shortcuts";
import { useBoardsNav } from "./useBoardsNav";

/** Sidebar item for the archive board (seminarians, non-candidates); empty until it exists. */
export function useArchiveNavItems(): {
  slug: string;
  name: string;
  href: string;
  reactIcon: React.ReactNode;
  keyboardShortcut: KeyboardShortcut;
}[] {
  const router = useRouter();
  const { archiveBoardHref } = useBoardsNav();

  if (!archiveBoardHref) return [];

  return [
    {
      slug: "archive",
      name: t`Archive`,
      href: archiveBoardHref,
      reactIcon: (
        <HiOutlineFolder className="h-[18px] w-[18px] text-light-1000 dark:text-dark-1000" />
      ),
      keyboardShortcut: {
        type: "SEQUENCE",
        strokes: [{ key: "G" }, { key: "R" }],
        action: () => router.push(archiveBoardHref),
        group: "NAVIGATION",
        description: t`Go to archive`,
      },
    },
  ];
}
