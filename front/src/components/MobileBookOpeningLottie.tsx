import { BookOpen } from "lucide-react";

// Keep the loading screen local: downloading an animation player, WASM and
// remote artwork here competes with the book on slower connections.
export function MobileBookOpeningLottie() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-background"
      aria-label="Carregando livro"
      role="status"
    >
      <BookOpen
        aria-hidden="true"
        className="size-20 text-primary motion-safe:animate-pulse"
        strokeWidth={1.25}
      />
      <p className="text-sm text-muted-foreground">Preparando sua leitura…</p>
    </div>
  );
}
