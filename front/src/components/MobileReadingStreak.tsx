import { useEffect, useRef } from "react";

const ACTIVE_LOTTIE = "https://lottie.host/3c825052-be2b-49de-a485-5b7fcfeb3b94/cIOuB5sSbX.lottie";
const DOTLOTTIE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.80.0/+esm";

export function MobileReadingStreak({ days, activeToday }: { days: number; activeToday: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let player: { destroy?: () => void; play?: () => void; pause?: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const mod = (await import(/* @vite-ignore */ DOTLOTTIE_MODULE_URL)) as {
          DotLottie: new (options: { autoplay: boolean; loop: boolean; canvas: HTMLCanvasElement; src: string }) => typeof player;
        };
        if (cancelled) return;
        player = new mod.DotLottie({ autoplay: activeToday, loop: true, canvas, src: ACTIVE_LOTTIE });
        if (!activeToday) player?.pause?.();
      } catch (error) {
        console.warn("Não foi possível carregar a animação da Ativa.", error);
      }
    })();
    return () => { cancelled = true; player?.destroy?.(); };
  }, [activeToday]);

  return (
    <section className="sm:hidden" aria-label="Sequência de leitura">
      <div className="relative overflow-hidden rounded-[1.45rem] border border-border/60 bg-card/70 px-4 py-3 shadow-[0_20px_55px_-38px_rgba(0,0,0,.9)] backdrop-blur-xl">
        <div className="flex min-h-[92px] items-center gap-3">
          <div className={`grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-[1.25rem] bg-background/45 transition ${activeToday ? "" : "grayscale opacity-45"}`}>
            <canvas ref={canvasRef} width={180} height={180} className="size-[72px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <strong className="text-[1.75rem] font-bold leading-none tracking-tight tabular-nums">{days}</strong>
              <span className="text-sm font-semibold">{days === 1 ? "dia de Ativa" : "dias de Ativa"}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {activeToday ? "Ativa de hoje concluída. Continue assim!" : days > 0 ? "Leia qualquer obra hoje para manter sua Ativa." : "Leia qualquer obra hoje para começar sua Ativa."}
            </p>
          </div>
          <span className={`size-2.5 shrink-0 rounded-full ${activeToday ? "bg-primary shadow-[0_0_16px_var(--primary)]" : "bg-muted-foreground/35"}`} />
        </div>
      </div>
    </section>
  );
}
