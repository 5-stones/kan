import Link from "next/link";
import { t } from "@lingui/core/macro";
import { HiArrowLongLeft } from "react-icons/hi2";

import { useBoardsNav } from "./useBoardsNav";

/** Back link from settings and members to the pipeline board. */
export default function ReturnToDiscerners() {
  const { mainBoardHref } = useBoardsNav();

  return (
    <Link
      href={mainBoardHref}
      className="return-to-discerners mb-6 inline-flex items-center gap-2 text-sm text-light-900 hover:text-light-1000 dark:text-dark-900 dark:hover:text-dark-1000"
    >
      <HiArrowLongLeft className="h-4 w-4" aria-hidden="true" />
      {t`return to discerners`}
    </Link>
  );
}
