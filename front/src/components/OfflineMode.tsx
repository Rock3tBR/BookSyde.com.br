import { PublicationCover } from "@/components/PublicationCover";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, CloudOff, MoveDown, MoveHorizontal, Play, X } from "lucide-react";

import {
  getOfflinePageUrls,
  getOfflineVolumeIds,
  getOfflineVolume,
  type OfflineVolume,
} from "@/lib/offlineVolumes";

import { EpubReader } from "@/components/EpubReader";
import { BrandLogo } from "@/components/BrandLogo";

// Montado apenas quando o dispositivo fica offline; não entra no bundle inicial.
export function OfflineExperience({ children, pathname }: { children: ReactNode; pathname: string }) {
  const [readerVolumeId, setReaderVolumeId] = useState<string | null>(null);
  useEffect(() => {
    const openReader = (event: Event) => setReaderVolumeId((event as CustomEvent<string>).detail);
    window.addEventListener("mangaka-open-offline-volume", openReader);
    return () => window.removeEventListener("mangaka-open-offline-volume", openReader);
  }, []);

  const selectedVolume = readerVolumeId ? getOfflineVolume(readerVolumeId) : null;
  if (selectedVolume) {
    return selectedVolume.fileFormat === "epub"
      ? <EpubReader key={selectedVolume.volumeId} volumeId={selectedVolume.volumeId} onClose={() => setReaderVolumeId(null)} />
      : <OfflineReader key={selectedVolume.volumeId} volume={selectedVolume} onClose={() => setReaderVolumeId(null)} />;
  }
  const readerMatch = pathname.match(/^\/ler\/([^/]+)$/);
  if (readerMatch && getOfflineVolume(readerMatch[1]!)) return children;
  return <OfflineHome />;
}

function OfflineHome() {
  const [volumes, setVolumes] = useState<OfflineVolume[]>(() =>
    getOfflineVolumeIds().flatMap((id) => {
      const volume = getOfflineVolume(id);
      return volume ? [volume] : [];
    }),
  );
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    const refresh = () =>
      setVolumes(
        getOfflineVolumeIds().flatMap((id) => {
          const volume = getOfflineVolume(id);
          return volume ? [volume] : [];
        }),
      );
    window.addEventListener("mangaka-offline-updated", refresh);
    return () => window.removeEventListener("mangaka-offline-updated", refresh);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all(
      volumes.map(async (volume) => {
        const saved = Number(localStorage.getItem(`mangaka-page-${volume.volumeId}`));
        const pageIndex =
          Number.isInteger(saved) && saved >= 0 ? Math.min(saved, volume.pages.length - 1) : 0;
        const page = volume.pages.find((item) => item.page_index === pageIndex) ?? volume.pages[0];
        if (!page) return null;
        const [url] = await getOfflinePageUrls(volume.volumeId, [page]);
        return url ? ([volume.volumeId, url] as const) : null;
      }),
    ).then((entries) => {
      if (active)
        setPreviews(
          Object.fromEntries(
            entries.filter((entry): entry is readonly [string, string] => !!entry),
          ),
        );
    });
    return () => {
      active = false;
    };
  }, [volumes]);

  const continueVolume = useMemo(() => {
    return [...volumes].sort((a, b) => {
      const aUpdated = Number(localStorage.getItem(`mangaka-page-updated-${a.volumeId}`)) || 0;
      const bUpdated = Number(localStorage.getItem(`mangaka-page-updated-${b.volumeId}`)) || 0;
      return (
        bUpdated - aUpdated ||
        new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
      );
    })[0];
  }, [volumes]);

  return (
    <main className="min-h-dvh bg-background px-4 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center gap-3 border-b pb-5">
          <BrandLogo showName imageClassName="size-11" nameClassName="text-xl" />
          <p className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <CloudOff className="size-3.5" /> Modo offline
          </p>
        </header>

        {!volumes.length ? (
          <section className="mx-auto max-w-md py-24 text-center">
            <CloudOff className="mx-auto size-10 text-muted-foreground" />
            <h1 className="mt-5 font-display text-2xl">Nenhum volume offline</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Conecte-se à internet, abra uma obra e conclua o download de um volume para ler sem
              conexão.
            </p>
          </section>
        ) : (
          <>
            {continueVolume ? (
              <section className="py-7">
                <p className="text-sm text-primary">Sua última leitura baixada</p>
                <h1 className="font-display text-2xl">Continuar lendo</h1>
                <OfflineVolumeCard
                  volume={continueVolume}
                  preview={previews[continueVolume.volumeId]}
                  featured
                />
              </section>
            ) : null}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                <h2 className="font-display text-xl">Ler offline</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {volumes.map((volume) => (
                  <OfflineVolumeCard
                    key={volume.volumeId}
                    volume={volume}
                    preview={previews[volume.volumeId]}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function OfflineVolumeCard({
  volume,
  preview,
  featured = false,
}: {
  volume: OfflineVolume;
  preview?: string | undefined;
  featured?: boolean | undefined;
}) {
  const saved = Number(localStorage.getItem(`mangaka-page-${volume.volumeId}`));
  const currentPage =
    Number.isInteger(saved) && saved >= 0 ? Math.min(saved + 1, volume.pages.length) : 1;
  const percent = Math.round((currentPage / Math.max(volume.pages.length, 1)) * 100);
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("mangaka-open-offline-volume", { detail: volume.volumeId }),
        )
      }
      className={`group mt-3 block overflow-hidden rounded-xl border bg-card ${featured ? "max-w-sm" : ""}`}
    >
      <div className="relative aspect-[7/5] overflow-hidden bg-muted">
        {preview ? (
          <PublicationCover coverUrl={preview} title={volume.mangaTitle} workType={volume.workType} className="size-full" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
        <Play className="absolute bottom-3 right-3 size-8 rounded-full bg-primary p-2 text-primary-foreground" />
      </div>
      <div className="p-3 text-left">
        <p className="truncate text-sm font-semibold">{volume.mangaTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Volume: {volume.volumeNumber} · {volume.fileFormat === "epub" ? "Livro completo" : `Página ${currentPage}/${volume.pages.length}`}
        </p>
        {volume.fileFormat !== "epub" ? <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div> : null}
      </div>
    </button>
  );
}

function OfflineReader({ volume, onClose }: { volume: OfflineVolume; onClose: () => void }) {
  const savedPage = Number(localStorage.getItem(`mangaka-page-${volume.volumeId}`));
  const [index, setIndex] = useState(
    Number.isInteger(savedPage) && savedPage >= 0
      ? Math.min(savedPage, Math.max(volume.pages.length - 1, 0))
      : 0,
  );
  const [readingMode, setReadingMode] = useState<"paged" | "vertical">(
    localStorage.getItem("mangaka-reading-mode") === "vertical" ? "vertical" : "paged",
  );
  const [pageUrls, setPageUrls] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef<Record<number, string>>({});
  const readingDirection =
    volume.workType === "hq" || volume.workType === "gibi" || volume.workType === "book"
      ? "book"
      : "manga";
  const brightness = Number(localStorage.getItem("mangaka-reader-brightness")) || 100;
  const background = localStorage.getItem("mangaka-reader-background");
  const progressStyle = localStorage.getItem("mangaka-progress-style") ?? "full";

  useEffect(() => {
    localStorage.setItem("mangaka-reading-mode", readingMode);
  }, [readingMode]);

  useEffect(() => {
    const existing = urlsRef.current;
    Object.values(existing).forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = {};
    setPageUrls({});
    setError("");
    return () => {
      Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = {};
    };
  }, [volume.volumeId]);

  useEffect(() => {
    let active = true;
    const start = readingMode === "vertical" ? Math.max(0, index - 3) : index;
    const end = readingMode === "vertical" ? Math.min(volume.pages.length, index + 7) : index + 1;
    const pendingIndexes: number[] = [];
    const pendingPages = volume.pages.slice(start, end).filter((_, offset) => {
      const pageIndex = start + offset;
      if (urlsRef.current[pageIndex]) return false;
      pendingIndexes.push(pageIndex);
      return true;
    });

    if (!pendingPages.length) return;
    void getOfflinePageUrls(volume.volumeId, pendingPages).then((urls) => {
      if (!active) {
        urls.forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        });
        return;
      }
      const next = { ...urlsRef.current };
      urls.forEach((url, position) => {
        const pageIndex = pendingIndexes[position];
        if (url && pageIndex !== undefined) next[pageIndex] = url;
      });
      urlsRef.current = next;
      setPageUrls(next);
      if (!next[index]) {
        setError("O download desta página está incompleto. Conecte-se e baixe o volume novamente.");
      } else {
        setError("");
      }
    });

    return () => {
      active = false;
    };
  }, [index, readingMode, volume]);

  useEffect(() => {
    if (readingMode !== "vertical" || !scrollRef.current) return;
    const root = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const nextIndex = Number((visible.target as HTMLElement).dataset["offlinePage"]);
        if (Number.isInteger(nextIndex)) setIndex(nextIndex);
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    );
    root.querySelectorAll<HTMLElement>("[data-offline-page]").forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [readingMode, volume.pages.length]);

  useEffect(() => {
    if (readingMode !== "vertical" || !scrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector<HTMLElement>(`[data-offline-page="${index}"]`)
        ?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
    // Somente ao entrar no modo vertical ou abrir outro volume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingMode, volume.volumeId]);

  useEffect(() => {
    localStorage.setItem(`mangaka-page-${volume.volumeId}`, String(index));
    localStorage.setItem(`mangaka-page-updated-${volume.volumeId}`, String(Date.now()));
  }, [index, volume.volumeId]);

  function changePage(delta: number) {
    setIndex((current) => Math.max(0, Math.min(current + delta, volume.pages.length - 1)));
  }

  const backgroundColor =
    background === "sepia" ? "#d8c9a7" : background === "gray" ? "#343434" : "#000000";

  return (
    <main
      className="fixed inset-0 z-[200] flex min-h-dvh flex-col overflow-hidden text-white"
      style={{ backgroundColor }}
    >
      <header className="flex items-center gap-2 border-b border-white/10 bg-black/75 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{volume.mangaTitle}</p>
          <p className="text-xs text-white/60">
            Volume {volume.volumeNumber} · Página {index + 1}/{volume.pages.length} · Offline
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReadingMode((mode) => (mode === "paged" ? "vertical" : "paged"))}
          className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 text-xs font-medium"
        >
          {readingMode === "paged" ? <MoveDown className="size-4" /> : <MoveHorizontal className="size-4" />}
          {readingMode === "paged" ? "Scroll" : "Páginas"}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar leitor offline"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10"
        >
          <X className="size-5" />
        </button>
      </header>

      {readingMode === "vertical" ? (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
          style={{ filter: `brightness(${brightness}%)`, WebkitOverflowScrolling: "touch" }}
        >
          <div className="mx-auto w-full max-w-[1100px]">
            {volume.pages.map((page, pageIndex) => (
              <section
                key={page.id}
                data-offline-page={pageIndex}
                className="flex min-h-[62dvh] w-full items-center justify-center border-b border-white/5 bg-black"
              >
                {pageUrls[pageIndex] ? (
                  <img
                    src={pageUrls[pageIndex]}
                    alt={`Página ${pageIndex + 1}`}
                    className="block h-auto w-full select-none object-contain"
                    draggable={false}
                    loading={Math.abs(pageIndex - index) <= 2 ? "eager" : "lazy"}
                  />
                ) : (
                  <div className="px-6 text-center text-sm text-white/55">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Página {pageIndex + 1}</p>
                    <p className="mt-2">{pageIndex === index && error ? error : "Carregando página offline…"}</p>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
          style={{ filter: `brightness(${brightness}%)` }}
          onPointerDown={(event) => {
            startRef.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = startRef.current;
            startRef.current = null;
            if (!start) return;
            const deltaX = event.clientX - start.x;
            if (Math.abs(deltaX) < 45) return;
            const forward = readingDirection === "manga" ? deltaX > 0 : deltaX < 0;
            changePage(forward ? 1 : -1);
          }}
        >
          {pageUrls[index] ? (
            <img
              src={pageUrls[index]}
              alt={`Página ${index + 1}`}
              className="h-full w-full select-none object-contain"
              draggable={false}
            />
          ) : (
            <div className="max-w-sm px-6 text-center text-sm text-white/75">
              <p>{error || "Abrindo página offline…"}</p>
            </div>
          )}
        </div>
      )}

      {progressStyle !== "hidden" ? (
        progressStyle === "minimal" ? (
          <div className="h-1 bg-white/15">
            <div
              className="h-full bg-primary"
              style={{ width: `${((index + 1) / Math.max(volume.pages.length, 1)) * 100}%` }}
            />
          </div>
        ) : (
          <footer className="flex justify-between bg-black/70 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-xs backdrop-blur">
            <span>{index + 1}/{volume.pages.length}</span>
            <span>{Math.round(((index + 1) / Math.max(volume.pages.length, 1)) * 100)}%</span>
          </footer>
        )
      ) : null}
    </main>
  );
}

