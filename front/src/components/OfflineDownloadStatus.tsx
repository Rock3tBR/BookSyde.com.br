import { AlertTriangle, Check, X } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { CrowDownloadAnimation } from "@/components/CrowDownloadAnimation";
import { getOfflineDownloads, subscribeOfflineDownloads } from "@/lib/offlineVolumes";

let snapshot = getOfflineDownloads();
function subscribe(listener: () => void) {
  return subscribeOfflineDownloads(() => {
    snapshot = getOfflineDownloads();
    listener();
  });
}

type VisualState = "initializing" | "downloading" | "processing" | "almost" | "complete" | "error";

const VISUALS: Record<VisualState, { title: string; subtitle: string }> = {
  initializing: { title: "Preparando sua leitura", subtitle: "Organizando tudo para começar..." },
  downloading: { title: "Baixando seu livro", subtitle: "O corvo já começou a leitura." },
  processing: { title: "Organizando páginas", subtitle: "Guardando tudo na sua biblioteca..." },
  almost: { title: "Quase lá", subtitle: "Só mais algumas páginas..." },
  complete: { title: "Pronto para ler!", subtitle: "Download concluído com sucesso." },
  error: { title: "Download interrompido", subtitle: "Algo deu errado durante o download." },
};

function getVisualState(state: string, percent: number): VisualState {
  if (state === "error") return "error";
  if (state === "complete") return "complete";
  if (state === "queued" || percent <= 3) return "initializing";
  if (percent >= 88) return "almost";
  if (percent >= 45) return "processing";
  return "downloading";
}

export function OfflineDownloadStatus() {
  const items = useSyncExternalStore(subscribe, () => snapshot, () => []);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const visibleItems = useMemo(() => items.filter((item) => !dismissed[item.volumeId]), [dismissed, items]);

  if (!visibleItems.length) return null;

  return (
    <div className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[110] flex flex-col-reverse gap-2 sm:left-auto sm:right-4 sm:w-[390px]">
      {visibleItems.map((item) => {
        const percent = item.total ? Math.min(100, Math.round((item.completed / item.total) * 100)) : 0;
        const visualState = getVisualState(item.state, percent);
        const visual = VISUALS[visualState];
        const isError = visualState === "error";
        const isComplete = visualState === "complete";

        return (
          <aside key={item.volumeId} className="overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 px-3 pt-2.5 sm:px-4">
              <CrowDownloadAnimation state={visualState} />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {isError ? <AlertTriangle className="size-4 text-destructive" /> : isComplete ? <Check className="size-4 text-primary" /> : null}
                      {visual.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{isError ? item.error || visual.subtitle : visual.subtitle}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground/80">{item.label}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-1 size-7 shrink-0 rounded-full" aria-label="Fechar download" onClick={() => setDismissed((current) => ({ ...current, [item.volumeId]: true }))}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-3 pb-3 pt-2 sm:px-4">
              <div className="relative h-2 overflow-visible rounded-full bg-muted">
                <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${isError ? "bg-destructive" : "bg-primary"}`} style={{ width: `${isError && percent === 0 ? 22 : percent}%` }} />
                {!isError && !isComplete && (
                  <div className="absolute -top-1.5 size-5 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow-md transition-[left] duration-500 ease-out" style={{ left: `${Math.max(3, percent)}%` }} />
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{isError ? "Toque no download novamente para tentar de novo" : isComplete ? "Salvo para leitura offline" : `${item.completed} de ${item.total || "…"}`}</span>
                <strong className={isError ? "text-destructive" : "text-foreground"}>{isError ? "Erro" : `${percent}%`}</strong>
              </div>
            </div>


          </aside>
        );
      })}
    </div>
  );
}
