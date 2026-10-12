import { t } from "@lingui/core/macro";
import { useCallback, useEffect, useState } from "react";
import { HiOutlineMinusCircle, HiOutlinePlusCircle } from "react-icons/hi2";

const storageKey = "coraggio:boardCompact";

/** Pipeline (zoomed-out) board view: every status at once, contacts by name only. */
export function useBoardZoom() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    try {
      setCompact(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // storage unavailable
    }
  }, []);

  const toggle = useCallback(() => {
    setCompact((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // storage unavailable; keep the in-memory value
      }
      return next;
    });
  }, []);

  return { compact, toggle };
}

/** Round button in the board's bottom-right corner: zoom out to the pipeline, or back in. */
export function BoardZoomToggle({
  compact,
  onToggle,
}: {
  compact: boolean;
  onToggle: () => void;
}) {
  const label = compact ? t`Show contact details` : t`Zoom out to the pipeline`;
  const Icon = compact ? HiOutlinePlusCircle : HiOutlineMinusCircle;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={compact}
      title={label}
      className="board-zoom-toggle absolute bottom-6 right-6 z-20 hidden h-11 w-11 items-center justify-center rounded-full text-light-1000 hover:opacity-80 focus-visible:outline-none dark:text-dark-1000 md:flex"
    >
      <Icon className="h-11 w-11" strokeWidth={1.5} />
    </button>
  );
}
