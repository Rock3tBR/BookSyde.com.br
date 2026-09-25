import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Palette } from "lucide-react";

import { RealisticBookModel } from "@/components/RealisticBookModel";
import { MangaCover, type MangaSummary } from "@/components/MangaCard";
import type { CatalogDisplayStyle } from "@/lib/catalogDisplay";
import { resolveCoverUrl } from "@/lib/media";
import { formatMarketplacePrice } from "@/lib/marketplace";

export function CatalogDisplayCard({
  manga,
  style,
  favorite = false,
  onToggleFavorite,
  index = 0,
  coverFit = "cover",
  showPersonalization = false,
}: {
  manga: MangaSummary;
  style: Exclude<CatalogDisplayStyle, "grid">;
  favorite?: boolean;
  onToggleFavorite?: (() => void) | undefined;
  index?: number;
  coverFit?: "cover" | "contain";
  showPersonalization?: boolean;
}) {
  if (style === "realistic") {
    return (
      <Realistic3DCard
        manga={manga}
        favorite={favorite}
        onToggleFavorite={onToggleFavorite}
        coverFit={coverFit}
        showPersonalization={showPersonalization}
      />
    );
  }

  if (style === "showcase") {
    return (
      <ShowcaseCard
        manga={manga}
        favorite={favorite}
        onToggleFavorite={onToggleFavorite}
        index={index}
        coverFit={coverFit}
        showPersonalization={showPersonalization}
      />
    );
  }

  return (
    <PhysicalBookCard
      manga={manga}
      favorite={favorite}
      onToggleFavorite={onToggleFavorite}
      coverFit={coverFit}
      showPersonalization={showPersonalization}
    />
  );
}


function Realistic3DCard({
  manga,
  favorite,
  onToggleFavorite,
  coverFit: _coverFit,
  showPersonalization,
}: {
  manga: MangaSummary;
  favorite: boolean;
  onToggleFavorite?: (() => void) | undefined;
  coverFit: "cover" | "contain";
  showPersonalization: boolean;
}) {
  return (
    <article className="realistic-book-card group relative min-w-0">
      <div className="realistic-book-stage relative mx-auto w-full pb-3">
        <div className="relative">
          <Link
            to="/manga/$slug"
            params={{ slug: manga.slug }}
            search={{ invite: "" }}
            aria-label={`Abrir ${manga.title}`}
            className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="realistic-book-volume relative mx-auto aspect-[7/8] w-full overflow-visible">
              <RealisticBookModel coverUrl={manga.cover_url} title={manga.title} />
            </div>
          </Link>

          {onToggleFavorite ? (
            <FavoriteButton
              favorite={favorite}
              title={manga.title}
              onClick={onToggleFavorite}
              className="right-2 top-2"
            />
          ) : null}
          {showPersonalization ? (
            <PersonalizationButton
              title={manga.title}
              className={`right-2 ${onToggleFavorite ? "top-12" : "top-2"}`}
            />
          ) : null}
        </div>

        <Link
          to="/manga/$slug"
          params={{ slug: manga.slug }}
          search={{ invite: "" }}
          className="mt-1 block text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <h3 className="line-clamp-2 min-h-10 max-h-10 overflow-hidden break-words text-sm font-medium leading-5 transition group-hover:text-primary">
            {manga.title}
          </h3>
          <p className="mt-1 truncate text-xs italic text-muted-foreground">
            {manga.author || "Autor desconhecido"}
          </p>
          <p className="mt-1 text-xs font-semibold text-primary">
            {Number(manga.price_cents) >= 100
              ? formatMarketplacePrice(manga.price_cents, manga.currency)
              : "Grátis"}
          </p>
        </Link>
      </div>
    </article>
  );
}

function PhysicalBookCard({
  manga,
  favorite,
  onToggleFavorite,
  coverFit,
  showPersonalization,
}: {
  manga: MangaSummary;
  favorite: boolean;
  onToggleFavorite?: (() => void) | undefined;
  coverFit: "cover" | "contain";
  showPersonalization: boolean;
}) {
  const dominantColor = useDominantCoverColor(manga.cover_url);
  const palette = useMemo(() => createBookPalette(dominantColor), [dominantColor]);

  return (
    <article className="group relative min-w-0">
      <div className="relative mx-auto w-full pb-5 pt-2">
        <Link
          to="/manga/$slug"
          params={{ slug: manga.slug }}
          search={{ invite: "" }}
          aria-label={`Abrir ${manga.title}`}
          className="relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="relative mx-auto aspect-[7/10] w-[92%] [perspective:1100px]">
            <div className="absolute inset-0 transition-[transform,filter] duration-300 ease-out [transform-style:preserve-3d] group-hover:[transform:translateY(-5px)_rotateY(-1.2deg)_rotateX(.45deg)]">
              <div className="pointer-events-none absolute -bottom-[30px] left-[3%] right-[-3%] z-0 h-[46px] rounded-[50%] bg-black/55 blur-[18px] opacity-55 transition-opacity duration-300 group-hover:opacity-75" />

              {/* Capa traseira usando a própria imagem escurecida. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-[24px] -left-[8px] -right-[7px] -top-[4px] z-[1] overflow-hidden rounded-[11px] bg-[#171717] shadow-[0_18px_26px_-16px_rgba(0,0,0,.92)] [&_.book-cover]:h-full [&_.book-cover]:w-full [&_.book-cover]:rounded-[inherit] [&_.book-cover]:brightness-[.42] [&_.book-cover]:saturate-[.82]"
              >
                <MangaCover coverUrl={manga.cover_url} title={manga.title} fit={coverFit} />
                <div className="absolute inset-0 bg-black/24" />
                <div className="absolute inset-y-0 left-0 w-[12px] bg-gradient-to-r from-black/45 via-black/18 to-transparent" />
                <div
                  className="absolute inset-x-0 bottom-0 h-[15px]"
                  style={{
                    background: `linear-gradient(to bottom, ${palette.base}, ${palette.dark})`,
                  }}
                />
              </div>

              {/* Lombada externa acompanhando a cor da capa. */}
              <div
                className="pointer-events-none absolute -bottom-[19px] -left-[9px] top-[7px] z-[2] w-[13px] overflow-hidden rounded-l-[10px] shadow-[inset_1px_0_0_rgba(255,255,255,.08),-3px_6px_10px_-6px_rgba(0,0,0,.8)]"
                style={{
                  background: `linear-gradient(90deg, ${palette.darker} 0%, ${palette.dark} 36%, ${palette.base} 62%, ${palette.darker} 100%)`,
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.28),rgba(255,255,255,.10)_42%,rgba(0,0,0,.14)_76%,rgba(255,255,255,.05))]" />
              </div>

              <div
                className="pointer-events-none absolute -bottom-[18px] left-[6px] right-[2px] z-[4] h-[23px] rounded-b-[7px] rounded-t-[2px] border border-[#cfc5b5]/90 shadow-[inset_0_2px_1px_rgba(255,255,255,.9),0_3px_7px_-5px_rgba(0,0,0,.75)]"
                style={{
                  backgroundColor: "#eee7dc",
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, rgba(255,255,255,.78) 0px, rgba(255,255,255,.78) 1px, rgba(187,174,155,.32) 1px, rgba(187,174,155,.32) 2px, rgba(238,231,220,.98) 2px, rgba(238,231,220,.98) 3px)",
                }}
              >
                <span className="absolute -left-[1px] bottom-[2px] top-[2px] w-[14px] rounded-l-[999px] border-l border-[#b8aa95]/80 bg-[radial-gradient(ellipse_at_right,rgba(255,255,255,.96)_0%,rgba(235,225,211,.96)_56%,rgba(184,169,148,.66)_100%)] shadow-[inset_4px_0_5px_-4px_rgba(0,0,0,.45)]" />
                <span className="absolute inset-x-[12px] top-0 h-[4px] bg-gradient-to-b from-black/18 to-transparent" />
              </div>

              <div
                className="pointer-events-none absolute bottom-[3px] right-[-5px] top-[8px] z-[5] w-[8px] rounded-r-[5px] border-y border-r border-[#cfc5b5]/70 shadow-[2px_2px_7px_-5px_rgba(0,0,0,.78)]"
                style={{
                  backgroundColor: "#ece4d8",
                  backgroundImage:
                    "repeating-linear-gradient(to right, rgba(255,255,255,.5) 0px, rgba(255,255,255,.5) 1px, rgba(184,171,153,.2) 1px, rgba(184,171,153,.2) 2px)",
                }}
              />

              <span className="pointer-events-none absolute bottom-[-53px] right-[13%] z-[7] h-[62px] w-[18px] bg-[linear-gradient(90deg,#c8842f_0%,#efb65f_24%,#e5a247_58%,#bf7627_100%)] shadow-[0_10px_12px_-8px_rgba(0,0,0,.88)] [clip-path:polygon(0_0,100%_0,100%_83%,50%_100%,0_83%)] before:absolute before:inset-y-0 before:left-[3px] before:w-px before:bg-white/25 before:content-[''] after:absolute after:inset-y-0 after:right-[3px] after:w-px after:bg-black/12 after:content-['']" />

              <div className="absolute inset-0 z-10 overflow-hidden rounded-[8px] bg-card shadow-[0_12px_22px_-12px_rgba(0,0,0,.72),0_3px_7px_-4px_rgba(0,0,0,.9),inset_0_0_0_1px_rgba(255,255,255,.1)] [&_.book-cover]:h-full [&_.book-cover]:w-full [&_.book-cover]:rounded-none">
                <MangaCover coverUrl={manga.cover_url} title={manga.title} fit={coverFit} />

                {/* Lombada frontal com a própria cor da capa. */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 w-[8.8%] overflow-hidden mix-blend-multiply"
                  style={{
                    background: `linear-gradient(to right, ${palette.darker}, ${palette.dark} 52%, ${palette.base})`,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-black/28 via-black/10 to-transparent" />
                </div>
                <div className="pointer-events-none absolute inset-y-[1%] left-[7.7%] w-px bg-white/16 shadow-[1px_0_0_rgba(0,0,0,.3)]" />
                <div className="pointer-events-none absolute inset-y-[2%] left-[1.2%] w-[1.7%] rounded-full bg-white/10 blur-[.4px]" />

                <div className="pointer-events-none absolute inset-y-0 right-0 w-[2.2%] bg-gradient-to-l from-black/30 via-black/8 to-transparent" />

                <div
                  className="pointer-events-none absolute inset-0 opacity-[.1] mix-blend-soft-light"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,.17) 0px, rgba(255,255,255,.17) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.09) 0px, rgba(0,0,0,.09) 1px, transparent 1px, transparent 4px)",
                  }}
                />

                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(108deg,rgba(255,255,255,.16)_0%,transparent_15%,transparent_70%,rgba(255,255,255,.04)_100%)]" />
                <div className="pointer-events-none absolute inset-[2px] rounded-[6px] border border-white/10" />

                {/* Base da capa frontal agora puxando a cor da própria capa. */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[5px]"
                  style={{
                    background: `linear-gradient(to bottom, ${palette.base}, ${palette.dark})`,
                  }}
                />
              </div>

              {/* Filete frontal inferior acompanhando a cor da capa. */}
              <div
                className="pointer-events-none absolute -bottom-[3px] left-[1px] right-[1px] z-[12] h-[6px] rounded-b-[7px] shadow-[0_1px_0_rgba(255,255,255,.08)]"
                style={{
                  background: `linear-gradient(to bottom, ${palette.base}, ${palette.dark})`,
                }}
              />
            </div>
          </div>
        </Link>

        <Link
          to="/manga/$slug"
          params={{ slug: manga.slug }}
          search={{ invite: "" }}
          className="mx-auto mt-[66px] block w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <h3 className="line-clamp-2 min-h-10 max-h-10 overflow-hidden break-words text-[15px] font-semibold leading-5 transition-colors group-hover:text-primary sm:text-base">
            {manga.title}
          </h3>
          <p className="mt-1.5 truncate text-[13px] text-muted-foreground sm:text-sm">
            {manga.author || "Autor desconhecido"}
          </p>
          <p className="mt-1 text-xs font-semibold text-primary">
            {Number(manga.price_cents) >= 100
              ? formatMarketplacePrice(manga.price_cents, manga.currency)
              : "Grátis"}
          </p>
        </Link>

        {onToggleFavorite ? (
          <FavoriteButton
            favorite={favorite}
            title={manga.title}
            onClick={onToggleFavorite}
            className="right-[7%] top-4"
          />
        ) : null}
        {showPersonalization ? (
          <PersonalizationButton
            title={manga.title}
            className={`right-[7%] ${onToggleFavorite ? "top-14" : "top-4"}`}
          />
        ) : null}
      </div>
    </article>
  );
}


type RGB = { r: number; g: number; b: number };

const FALLBACK_COVER_COLOR: RGB = { r: 31, g: 31, b: 31 };
const dominantColorCache = new Map<string, RGB>();

/**
 * Descobre a cor predominante da CAPA REAL.
 *
 * Importante: manga.cover_url pode ser apenas "storage:<path>". O MangaCover
 * resolve esse caminho antes de mostrar a imagem, então fazemos a mesma coisa
 * aqui antes de tentar ler os pixels. Sem isso, a análise falha e todos os
 * livros acabam usando a cor fallback escura.
 */
function useDominantCoverColor(coverUrl?: string | null) {
  const [color, setColor] = useState<RGB>(() => {
    if (coverUrl) return dominantColorCache.get(coverUrl) ?? FALLBACK_COVER_COLOR;
    return FALLBACK_COVER_COLOR;
  });

  useEffect(() => {
    let cancelled = false;
    if (!coverUrl || typeof window === "undefined") {
      setColor(FALLBACK_COVER_COLOR);
      return;
    }

    const cached = dominantColorCache.get(coverUrl);
    if (cached) {
      setColor(cached);
      return;
    }

    async function analyseCover() {
      try {
        // Mesma resolução de URL usada pelo MangaCover.
        const resolvedUrl = await resolveCoverUrl(coverUrl ?? null);
        if (!resolvedUrl || cancelled) return;

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";

        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Não foi possível carregar a capa para análise."));
          image.src = resolvedUrl;
        });

        if (cancelled) return;

        const canvas = document.createElement("canvas");
        const width = 42;
        const height = 60;
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;

        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const buckets = new Map<
          string,
          { count: number; r: number; g: number; b: number }
        >();

        // Ignora uma pequena borda da imagem para não deixar molduras finas
        // influenciarem mais que a arte principal da capa.
        const borderX = 2;
        const borderY = 2;

        for (let y = borderY; y < height - borderY; y += 1) {
          for (let x = borderX; x < width - borderX; x += 1) {
            const index = (y * width + x) * 4;
            const alpha = pixels[index + 3] ?? 0;
            if (alpha < 180) continue;

            const r = pixels[index] ?? 0;
            const g = pixels[index + 1] ?? 0;
            const b = pixels[index + 2] ?? 0;

            // Agrupa tonalidades próximas. Assim vermelho escuro + vermelho
            // médio, por exemplo, contam como uma mesma família visual.
            const step = 24;
            const qr = Math.min(255, Math.round(r / step) * step);
            const qg = Math.min(255, Math.round(g / step) * step);
            const qb = Math.min(255, Math.round(b / step) * step);
            const key = `${qr}-${qg}-${qb}`;
            const bucket = buckets.get(key) ?? {
              count: 0,
              r: 0,
              g: 0,
              b: 0,
            };

            bucket.count += 1;
            bucket.r += r;
            bucket.g += g;
            bucket.b += b;
            buckets.set(key, bucket);
          }
        }

        let winner: { count: number; r: number; g: number; b: number } | null = null;

        for (const bucket of buckets.values()) {
          if (!winner || bucket.count > winner.count) winner = bucket;
        }

        if (!winner || winner.count === 0 || cancelled) return;

        const result: RGB = {
          r: Math.round(winner.r / winner.count),
          g: Math.round(winner.g / winner.count),
          b: Math.round(winner.b / winner.count),
        };

        if (coverUrl) dominantColorCache.set(coverUrl, result);
        setColor(result);
      } catch (error) {
        // Em uma URL externa sem CORS, o navegador não permite ler os pixels
        // do canvas. Nessa situação mantemos apenas o fallback.
        if (!cancelled) {
          console.warn("[BookSyde] Não foi possível extrair a cor da capa:", coverUrl, error);
          setColor(FALLBACK_COVER_COLOR);
        }
      }
    }

    void analyseCover();

    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  return color;
}

function createBookPalette(color: RGB) {
  return {
    // A cor predominante aparece de verdade na estrutura; as versões escuras
    // entram apenas nos vincos e sombras para manter o aspecto físico.
    base: rgbToCss(color),
    dark: rgbToCss(scaleRgb(color, 0.78)),
    darker: rgbToCss(scaleRgb(color, 0.58)),
    light: rgbToCss(mixRgb(color, { r: 255, g: 255, b: 255 }, 0.14)),
  };
}

function scaleRgb(color: RGB, factor: number): RGB {
  return {
    r: clampColor(color.r * factor),
    g: clampColor(color.g * factor),
    b: clampColor(color.b * factor),
  };
}

function mixRgb(a: RGB, b: RGB, amount: number): RGB {
  return {
    r: clampColor(a.r + (b.r - a.r) * amount),
    g: clampColor(a.g + (b.g - a.g) * amount),
    b: clampColor(a.b + (b.b - a.b) * amount),
  };
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToCss(color: RGB) {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

function ShowcaseCard({
  manga,
  favorite,
  onToggleFavorite,
  index,
  coverFit,
  showPersonalization,
}: {
  manga: MangaSummary;
  favorite: boolean;
  onToggleFavorite?: (() => void) | undefined;
  index: number;
  coverFit: "cover" | "contain";
  showPersonalization: boolean;
}) {
  const lift = ["md:pt-12", "md:pt-0", "md:pt-12", "md:pt-7"][index % 4];

  return (
    <article className={`group relative min-w-0 ${lift}`}>
      <div className="mx-auto w-full max-w-[225px] px-2 pb-3">
        <div className="relative">
          <Link
            to="/manga/$slug"
            params={{ slug: manga.slug }}
            search={{ invite: "" }}
            aria-label={`Abrir ${manga.title}`}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="relative aspect-[7/10] overflow-hidden rounded-[0.15rem] border border-border/45 bg-card shadow-[var(--shadow-card)] transition duration-300 group-hover:-translate-y-2 group-hover:shadow-[var(--shadow-card-hover)] [&_.book-cover]:h-full [&_.book-cover]:w-full [&_.book-cover]:rounded-none">
              <MangaCover coverUrl={manga.cover_url} title={manga.title} fit={coverFit} />
            </div>
          </Link>

          {onToggleFavorite ? (
            <FavoriteButton
              favorite={favorite}
              title={manga.title}
              onClick={onToggleFavorite}
              className="right-2 top-2"
            />
          ) : null}
          {showPersonalization ? (
            <PersonalizationButton
              title={manga.title}
              className={`right-2 ${onToggleFavorite ? "top-12" : "top-2"}`}
            />
          ) : null}
        </div>

        <Link
          to="/manga/$slug"
          params={{ slug: manga.slug }}
          search={{ invite: "" }}
          className="mt-4 block text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <h3 className="line-clamp-2 min-h-10 max-h-10 overflow-hidden break-words text-sm font-medium leading-5 transition group-hover:text-primary">
            {manga.title}
          </h3>
          <p className="mt-1 truncate text-xs italic text-muted-foreground">
            {manga.author || "Autor desconhecido"}
          </p>
          <p className="mt-1 text-xs font-semibold text-primary">
            {Number(manga.price_cents) >= 100
              ? formatMarketplacePrice(manga.price_cents, manga.currency)
              : "Grátis"}
          </p>
        </Link>
      </div>
    </article>
  );
}

function PersonalizationButton({ title, className }: { title: string; className: string }) {
  return (
    <Link
      to="/conta"
      search={{ tab: "catalog" }}
      aria-label={`Personalizar exibição de ${title}`}
      title="Personalizar exibição"
      className={`absolute z-30 grid size-8 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur transition hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <Palette className="size-4" />
    </Link>
  );
}

function FavoriteButton({
  favorite,
  title,
  onClick,
  className,
}: {
  favorite: boolean;
  title: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      aria-label={favorite ? `Remover ${title} dos favoritos` : `Favoritar ${title}`}
      title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      onClick={onClick}
      className={`absolute z-30 grid size-8 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur transition hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <Heart className={`size-4 ${favorite ? "fill-primary text-primary" : ""}`} />
    </button>
  );
}
