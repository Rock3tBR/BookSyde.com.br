import { lazy, Suspense, useEffect, useState } from "react";
import type { TutorialChapter } from "@/lib/tutorialEvents";

const SystemTutorial = lazy(() =>
  import("@/components/SystemTutorial").then(({ SystemTutorial }) => ({ default: SystemTutorial })),
);

// O tutorial é um recurso opcional: seu código é carregado quando alguém pede ajuda.
export function TutorialGate() {
  const [request, setRequest] = useState<{ id: number; chapter: TutorialChapter } | null>(null);

  useEffect(() => {
    const onStart = (event: Event) => {
      const chapter = (event as CustomEvent<{ chapter?: TutorialChapter }>).detail?.chapter ?? "all";
      setRequest((current) => ({ id: (current?.id ?? 0) + 1, chapter }));
    };
    window.addEventListener("mangaka:start-tutorial", onStart);
    return () => window.removeEventListener("mangaka:start-tutorial", onStart);
  }, []);

  if (!request) return null;
  return (
    <Suspense fallback={null}>
      <SystemTutorial request={request} />
    </Suspense>
  );
}
