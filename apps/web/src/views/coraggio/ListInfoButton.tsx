import { t } from "@lingui/core/macro";
import { useEffect, useRef } from "react";
import { HiOutlineInformationCircle } from "react-icons/hi2";
import tippy from "tippy.js";

/** (i) next to a status name that explains it, on hover or tap (board config `main.listInfo`). */
export function ListInfoButton({ info }: { info: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!buttonRef.current) return;
    const instance = tippy(buttonRef.current, {
      content: info,
      placement: "bottom-start",
      trigger: "mouseenter focus click",
      hideOnClick: true,
      maxWidth: 260,
      theme: "tooltip",
    });
    return () => instance.destroy();
  }, [info]);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={t`About this status`}
      className="board-list-info flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-light-900 hover:text-light-1000 focus-visible:outline-none dark:text-dark-900 dark:hover:text-dark-1000"
    >
      <HiOutlineInformationCircle className="h-[18px] w-[18px]" />
    </button>
  );
}
