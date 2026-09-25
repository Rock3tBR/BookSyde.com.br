import { useEffect, useRef, type PointerEvent } from "react";

export function useReaderLongPress(onHold: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const triggered = useRef(false);
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;
  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  useEffect(() => {
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
    };
  }, []);
  return {
    triggered,
    cancel,
    onPointerDown(event: PointerEvent) {
      cancel();
      if (!event.isPrimary || event.button !== 0) return;
      triggered.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        triggered.current = true;
        start.current = null;
        onHoldRef.current();
      }, 550);
    },
    onPointerMove(event: PointerEvent) {
      if (
        start.current &&
        (Math.abs(event.clientX - start.current.x) > 12 ||
          Math.abs(event.clientY - start.current.y) > 12)
      )
        cancel();
    },
  };
}
