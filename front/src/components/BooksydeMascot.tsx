import { useEffect, useRef, useState } from "react";
import "./BooksydeMascot.css";
import "./BooksydeMascot.frames.css";

/** The same complete frame sequence is used wherever the mascot appears. */
export function BooksydeMascot({ size = 108, paused = false }: { size?: number; paused?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const syncVisibility = () => setDocumentVisible(document.visibilityState === "visible");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false));
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="booksyde-mascot"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <div
        className="booksyde-mascot-sprite"
        style={{ animationPlayState: visible && documentVisible && !paused ? "running" : "paused" }}
      />
    </div>
  );
}
