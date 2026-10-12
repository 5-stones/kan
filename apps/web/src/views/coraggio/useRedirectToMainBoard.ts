import { useRouter } from "next/router";
import { useEffect } from "react";

import { useBoardsNav } from "./useBoardsNav";

/**
 * The boards list isn't part of Coraggio: login, workspace switching and the like
 * land on /boards, which forwards to the diocese's pipeline board. Returns true
 * while that is pending, so the page can render nothing instead of flashing the list.
 * Workspaces without a pipeline board still get the list.
 */
export function useRedirectToMainBoard() {
  const router = useRouter();
  const { isPending, main } = useBoardsNav();

  useEffect(() => {
    if (main) void router.replace(`/boards/${main.publicId}`);
  }, [main, router]);

  return isPending || !!main;
}
