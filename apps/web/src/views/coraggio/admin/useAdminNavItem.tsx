import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { HiOutlineBuildingLibrary } from "react-icons/hi2";

import type { KeyboardShortcut } from "~/providers/keyboard-shortcuts";
import { api } from "~/utils/api";

/** Sidebar item for the NSPV admin page; empty for everyone else. */
export function useAdminNavItems(): {
  slug: string;
  name: string;
  href: string;
  reactIcon: React.ReactNode;
  keyboardShortcut: KeyboardShortcut;
}[] {
  const router = useRouter();
  const { data } = api.coraggio.admin.me.useQuery(undefined, {
    staleTime: Infinity,
  });

  if (!data?.isAdmin) return [];

  return [
    {
      slug: "admin",
      name: t`NSPV Admin`,
      href: "/admin",
      reactIcon: (
        <HiOutlineBuildingLibrary className="h-[18px] w-[18px] text-light-1000 dark:text-dark-1000" />
      ),
      keyboardShortcut: {
        type: "SEQUENCE",
        strokes: [{ key: "G" }, { key: "A" }],
        action: () => router.push("/admin"),
        group: "NAVIGATION",
        description: t`Go to NSPV admin`,
      },
    },
  ];
}
