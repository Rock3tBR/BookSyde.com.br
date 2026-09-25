import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Heart, Palette } from "lucide-react";

import { resolveCoverUrl } from "@/lib/media";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { WORK_TYPES, type WorkType } from "@/lib/publication";

export type MangaSummary = {
  id: string;
  slug: string;
  title: string;
  author: string;
  cover_url: string | null;
  genres: string[];
  price_cents: number;
  currency: string;
  catalog_sale_enabled?: boolean;
  view_count?: number;
  work_type?: WorkType;
  synopsis?: string;
  creator_id?: string | null;
};

export function MangaCover({
  coverUrl,
  title,
  fallbackPagePath,
  fallbackCoverUrl,
  fit = "cover",
}: {
  coverUrl: string | null;
  title: string;
  fallbackPagePath?: string | null | undefined;
  fallbackCoverUrl?: string | null | undefined;
  fit?: "cover" | "contain";
}) {
  const { data: src } = useQuery({
    queryKey: ["cover", coverUrl, fallbackPagePath, fallbackCoverUrl],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      if (coverUrl) return resolveCoverUrl(coverUrl);
      if (fallbackPagePath) {
        const { data } = await supabase.storage
          .from("manga-pages")
          .createSignedUrl(fallbackPagePath, 60 * 60);
        if (data?.signedUrl) return data.signedUrl;
      }
      return resolveCoverUrl(fallbackCoverUrl ?? null);
    },
  });

  return (
    <div className="book-cover relative aspect-[7/10] w-full overflow-hidden rounded-[inherit] bg-secondary/60">
      {src ? (
        <>
          {fit === "contain" ? (
            <img
              src={src}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-xl"
            />
          ) : null}
          <img
            src={src}
            alt={`Capa de ${title}`}
            loading="lazy"
            className={cn(
              "relative size-full transition duration-500",
              fit === "contain"
                ? "object-contain p-1.5 group-hover:scale-[1.015]"
                : "object-cover group-hover:scale-[1.04]",
            )}
          />
        </>
      ) : (
        <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_58%)] font-display text-4xl text-muted-foreground">
          漫
        </div>
      )}
    </div>
  );
}

/**
 * Placeholder de carregamento para um MangaCard em modo grid. Reutilize
 * este componente em qualquer lista de obras (home, biblioteca, etc.) em
 * vez de recriar um bloco `animate-pulse` ad hoc — mantém o mesmo raio,
 * proporção e cor de fundo em toda a aplicação.
 */
export function MangaCardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`aspect-[7/10] w-full rounded-2xl ${className ?? ""}`} />;
}

export function MangaCard({
  manga,
  favorite = false,
  onToggleFavorite,
  coverFit = "cover",
  showPersonalization = false,
}: {
  manga: MangaSummary;
  favorite?: boolean;
  onToggleFavorite?: (() => void) | undefined;
  coverFit?: "cover" | "contain";
  showPersonalization?: boolean;
}) {
  const typeLabel = WORK_TYPES.find((type) => type.value === manga.work_type)?.label ?? "Mangá";

  return (
    <article className="group relative min-w-0">
      <Link
        to="/manga/$slug"
        params={{ slug: manga.slug }}
        search={{ invite: "" }}
        className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-[var(--shadow-card)] transition duration-300 group-hover:-translate-y-1 group-hover:border-primary/35 group-hover:shadow-[var(--shadow-card-hover)]">
          <div className="relative">
            <MangaCover coverUrl={manga.cover_url} title={manga.title} fit={coverFit} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/92 via-black/40 to-transparent" />
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/85 uppercase backdrop-blur">
                {typeLabel}
              </span>
              {typeof manga.view_count === "number" && manga.view_count > 0 ? (
                <span className="rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3" /> {manga.view_count}
                  </span>
                </span>
              ) : null}
            </div>
            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="line-clamp-2 font-display text-base font-semibold leading-tight text-white transition-colors group-hover:text-primary-foreground sm:text-[1.02rem]">
                {manga.title}
              </h3>
              <p className="mt-1 truncate text-xs text-white/70">{manga.author || "Autor desconhecido"}</p>
            </div>
          </div>
          <div className="space-y-3 px-4 pb-4 pt-3">
            {manga.genres.length ? (
              <div className="flex flex-wrap gap-1.5">
                {manga.genres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground shadow-[var(--shadow-chip)]"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              Biblioteca digital com leitura organizada e navegação imersiva.
            </p>
          </div>
        </div>
      </Link>
      {showPersonalization ? (
        <Link
          to="/conta"
          search={{ tab: "catalog" }}
          aria-label={`Personalizar exibição de ${manga.title}`}
          title="Personalizar exibição"
          className={cn(
            "absolute top-3 z-10 grid size-10 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            onToggleFavorite ? "right-14" : "right-3",
          )}
        >
          <Palette className="size-5" />
        </Link>
      ) : null}
      {onToggleFavorite ? (
        <button
          type="button"
          aria-label={favorite ? `Remover ${manga.title} dos favoritos` : `Favoritar ${manga.title}`}
          title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          onClick={onToggleFavorite}
          className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Heart className={`size-5 ${favorite ? "fill-primary text-primary" : ""}`} />
        </button>
      ) : null}
    </article>
  );
}
