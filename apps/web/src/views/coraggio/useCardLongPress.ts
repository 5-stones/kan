import type { TouchEvent } from "react";
import { useEffect, useRef } from "react";

const LONG_PRESS_MS = 500;
// finger movement that turns the press into a scroll or drag
const MOVE_TOLERANCE_PX = 10;

/**
 * Long-press on a board card opens the card context menu on touch screens
 * (iOS Safari never fires `contextmenu`). Returns touch handlers for one card.
 *
 * react-beautiful-dnd lifts the card after a short hold; holding still drops it
 * back in place, so the menu still opens. Moving cancels the long-press.
 */
export function useCardLongPress(
  onLongPress: (cardPublicId: string, x: number, y: number) => void,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  useEffect(() => cancel, []);

  return (cardPublicId: string) => ({
    onTouchStart: (e: TouchEvent) => {
      cancel();
      fired.current = false;
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch) return;
      const { clientX: x, clientY: y } = touch;
      start.current = { x, y };
      timer.current = setTimeout(() => {
        timer.current = undefined;
        fired.current = true;
        // typed as always present, but iOS Safari has no vibrate
        if ("vibrate" in navigator) navigator.vibrate(10);
        onLongPress(cardPublicId, x, y);
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!start.current || !touch) return;
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancel();
    },
    onTouchEnd: (e: TouchEvent) => {
      // no click after a long-press: it would open the card behind the menu
      if (fired.current) e.preventDefault();
      fired.current = false;
      cancel();
    },
    onTouchCancel: cancel,
  });
}
