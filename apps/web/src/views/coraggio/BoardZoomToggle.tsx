import { t } from "@lingui/core/macro";
import { useCallback, useEffect, useState } from "react";
import { HiOutlineMinusCircle, HiOutlinePlusCircle } from "react-icons/hi2";

// phones keep their own setting and start zoomed out (more statuses on screen)
const phoneQuery = "(max-width: 767px), (max-height: 500px)"; // as useIsMobile
const storageKeyFor = (phone: boolean) =>
  phone ? "coraggio:boardCompact:phone" : "coraggio:boardCompact";

/** Pipeline (zoomed-out) board view: every status at once, contacts by name only. */
export function useBoardZoom() {
  const [compact, setCompact] = useState(false);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const isPhone = window.matchMedia(phoneQuery).matches;
    setPhone(isPhone);
    try {
      const stored = window.localStorage.getItem(storageKeyFor(isPhone));
      setCompact(stored === null ? isPhone : stored === "1");
    } catch {
      setCompact(isPhone); // storage unavailable
    }
  }, []);

  const toggle = useCallback(() => {
    setCompact((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(storageKeyFor(phone), next ? "1" : "0");
      } catch {
        // storage unavailable; keep the in-memory value
      }
      return next;
    });
  }, [phone]);

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
      className="board-zoom-toggle absolute bottom-6 right-6 z-20 flex h-11 w-11 items-center justify-center rounded-full text-light-1000 hover:opacity-80 focus-visible:outline-none dark:text-dark-1000"
    >
      <Icon className="h-11 w-11" strokeWidth={1.5} />
    </button>
  );
}
