import Link from "next/link";
import { twMerge } from "tailwind-merge";

import { CORAGGIO_APP_NAME } from "@kan/shared";

import { useWorkspace } from "~/providers/workspace";
import { useBoardsNav } from "./useBoardsNav";

/** "coragg.io | <diocese>", linking to the main dashboard (the pipeline board). */
export default function AppLogo({ className }: { className?: string }) {
  const { workspace } = useWorkspace();
  const { mainBoardHref } = useBoardsNav();

  return (
    <Link
      href={mainBoardHref}
      className={twMerge("coraggio-logo flex flex-wrap items-baseline", className)}
    >
      <span className="coraggio-logo-name">{CORAGGIO_APP_NAME}</span>
      {workspace.name && (
        <span className="coraggio-logo-client">
          <span className="coraggio-logo-divider" aria-hidden="true">
            |
          </span>
          {workspace.name}
        </span>
      )}
    </Link>
  );
}
