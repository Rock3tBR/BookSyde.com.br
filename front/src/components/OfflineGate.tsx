import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

// A interface, o EPUB e os recursos de leitura só são baixados se faltar conexão.
const OfflineExperience = lazy(() =>
  import("@/components/OfflineMode").then(({ OfflineExperience }) => ({ default: OfflineExperience })),
);

export function OfflineGate({ children }: { children: ReactNode }) {
  // SSR e primeiro render usam o mesmo valor para impedir hydration mismatch.
  const [online, setOnline] = useState(true);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return children;
  return (
    <Suspense fallback={<main className="min-h-dvh bg-background" aria-label="Carregando biblioteca offline" />}>
      <OfflineExperience pathname={pathname}>{children}</OfflineExperience>
    </Suspense>
  );
}
