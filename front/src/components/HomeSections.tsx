import { personalPageCount, usePersonalLayouts } from "@/lib/readerPersonalization";
import { PublicationCover } from "@/components/PublicationCover";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock3,
  ExternalLink,
  Heart,
  Library,
  Play,
  Store,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { CatalogDisplayCard } from "@/components/CatalogDisplayCard";
import { MangaCardSkeleton, type MangaSummary } from "@/components/MangaCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoredContinueReadingPreview,
  useAuth,
  useProfile,
  type ContinueReadingPreview,
} from "@/lib/auth";
import { getCatalogDisplayPreferences, getCatalogDisplayStyle } from "@/lib/catalogDisplay";
import { WORK_TYPES, type WorkType, unitLabel } from "@/lib/publication";
import { formatMarketplacePrice } from "@/lib/marketplace";

import type { HomeManga, ContinueReadingItem, LatestUpdateItem } from "@/pages/index";


export function MobileQuickActions({ signedIn }: { signedIn: boolean }) {
  return (
    <nav className="grid grid-cols-2 gap-2 sm:hidden" aria-label="Atalhos rápidos">
      <Link
        to={signedIn ? "/biblioteca" : "/auth"}
        className="group flex min-h-20 items-center gap-3 rounded-[1.25rem] border border-border/60 bg-card/65 p-3.5 shadow-[0_18px_45px_-32px_rgba(0,0,0,.95)] backdrop-blur-xl transition active:scale-[.98]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Library className="size-5" />
        </span>
        <span className="min-w-0">
          <strong className="block text-sm font-semibold">Biblioteca</strong>
          <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
            {signedIn ? "Suas obras e downloads" : "Entre para ver suas obras"}
          </span>
        </span>
      </Link>

      <Link
        to="/marketplace"
        className="group flex min-h-20 items-center gap-3 rounded-[1.25rem] border border-border/60 bg-card/65 p-3.5 shadow-[0_18px_45px_-32px_rgba(0,0,0,.95)] backdrop-blur-xl transition active:scale-[.98]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Store className="size-5" />
        </span>
        <span className="min-w-0">
          <strong className="block text-sm font-semibold">Marketplace</strong>
          <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">Descubra novas leituras</span>
        </span>
      </Link>
    </nav>
  );
}

export function DailyReadingCard({
  seconds,
  signedIn,
  realistic = false,
}: {
  seconds: number;
  signedIn: boolean;
  realistic?: boolean;
}) {
  return (
    <div className={`relative min-h-[104px] overflow-hidden border border-border/60 p-4 backdrop-blur-xl sm:min-h-[122px] sm:p-5 lg:min-h-[145px] ${
      realistic
        ? "realistic-panel realistic-daily-card rounded-[12px] bg-card/72 shadow-[0_22px_60px_-38px_rgba(0,0,0,.95)]"
        : "rounded-[1.35rem] bg-card/55 shadow-[0_24px_60px_-42px_rgba(0,0,0,.9)] sm:rounded-[1.55rem]"
    }`}>
      <div className="absolute -right-8 -top-10 size-32 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex h-full items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock3 className="size-4" /> Leitura de hoje
          </p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-3xl">
            {signedIn ? formatReadingDuration(seconds) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {signedIn ? (seconds > 0 ? "Boa leitura! 📚" : "Comece uma leitura hoje.") : "Entre para acompanhar seu tempo."}
          </p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-full border border-border/60 bg-background/50">
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

export function ContinueReadingRail({
  items,
  previewMode,
  signedIn,
  realistic = false,
}: {
  items: ContinueReadingItem[];
  previewMode: ContinueReadingPreview;
  signedIn: boolean;
  realistic?: boolean;
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <aside className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border/60 backdrop-blur-xl lg:min-h-0 ${
      realistic
        ? "realistic-panel realistic-reading-rail rounded-[12px] bg-card/76 shadow-[0_28px_74px_-42px_rgba(0,0,0,.96)]"
        : "rounded-[1.35rem] bg-card/65 shadow-[0_26px_70px_-42px_rgba(0,0,0,.9)] sm:rounded-[1.6rem]"
    }`}>
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
            Sua leitura
          </p>
          <h2 className="mt-0.5 text-base font-semibold">Continue lendo</h2>
        </div>
        <BookOpen className="size-4 text-muted-foreground" />
      </div>

      {visibleItems.length ? (
        <>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden">
            {visibleItems.map((item) => (
              <ContinueReadingMobileCard
                key={item.volume_id}
                item={item}
                previewMode={previewMode}
                realistic={realistic}
              />
            ))}
          </div>

          <div className="hidden flex-1 gap-2 p-3 sm:grid sm:grid-cols-2 sm:p-4 lg:block lg:space-y-1.5 lg:overflow-hidden">
            {visibleItems.map((item) => (
              <ContinueReadingRow
                key={item.volume_id}
                item={item}
                previewMode={previewMode}
                realistic={realistic}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex min-h-44 flex-1 flex-col items-center justify-center px-6 py-8 text-center">
          <div className="grid size-11 place-items-center rounded-full border border-border/60 bg-background/60">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-semibold">
            {signedIn ? "Nenhuma leitura em andamento" : "Entre para continuar lendo"}
          </p>
          <p className="mt-1 max-w-48 text-xs leading-relaxed text-muted-foreground">
            {signedIn
              ? "As obras que você começar a ler aparecerão aqui."
              : "Seu progresso fica salvo e sincronizado na sua conta."}
          </p>
        </div>
      )}

      <div className="border-t border-border/50 p-3 sm:p-4">
        <Button asChild variant="ghost" className="h-10 w-full justify-between rounded-xl px-3 text-xs">
          <Link to={signedIn ? "/biblioteca" : "/auth"}>
            {signedIn ? "Ver toda a biblioteca" : "Entrar na conta"}
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}

function ContinueReadingMobileCard({
  item,
  previewMode,
  realistic = false,
}: {
  item: ContinueReadingItem;
  previewMode: ContinueReadingPreview;
  realistic?: boolean;
}) {
  const { user } = useAuth();
  const layouts = usePersonalLayouts(user?.id);
  const pageCount = Math.max(1, personalPageCount(item.volume, layouts));
  const personal = item.volume.file_format === "epub" ? layouts[item.volume.id] : undefined;
  const pageIndex = personal && personal.updatedAt >= (Date.parse(item.updated_at ?? "") || 0) ? personal.pageIndex : item.page_index;
  const percent = Math.max(1, Math.min(100, Math.round(((pageIndex + 1) / pageCount) * 100)));
  const previewUsesPage = previewMode === "page" && !!item.page_path;

  return (
    <Link
      to="/ler/$volumeId"
      params={{ volumeId: item.volume_id }}
      className={`group relative flex w-[82vw] max-w-[320px] shrink-0 snap-start overflow-hidden border border-border/55 p-3 transition active:scale-[.99] ${
        realistic ? "realistic-reading-item rounded-[10px] bg-background/36" : "rounded-[1.2rem] bg-background/40"
      }`}
    >
      <div className="w-[74px] shrink-0 overflow-hidden rounded-xl border border-border/50 shadow-md [&_.book-cover]:h-full [&_.book-cover]:rounded-none">
        <PublicationCover
          coverUrl={previewUsesPage ? null : item.volume.cover_url ?? item.manga.cover_url}
          fallbackPagePath={previewUsesPage ? item.page_path : undefined}
          fallbackCoverUrl={item.volume.cover_url ?? item.manga.cover_url}
          title={item.manga.title}
          workType={item.manga.work_type}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col pl-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{item.manga.title}</h3>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {unitLabel(item.volume.unit_kind)} {item.volume.number} · Página {pageIndex + 1} de {pageCount}
          </p>
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>Progresso</span>
            <span className="font-medium tabular-nums text-foreground/75">{percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <Play className="size-3 fill-current" /> Continuar leitura
          </span>
        </div>
      </div>
    </Link>
  );
}

function ContinueReadingRow({
  item,
  previewMode,
  realistic = false,
  className,
}: {
  item: ContinueReadingItem;
  previewMode: ContinueReadingPreview;
  realistic?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const layouts = usePersonalLayouts(user?.id);
  const pageCount = Math.max(1, personalPageCount(item.volume, layouts));
  const personal = item.volume.file_format === "epub" ? layouts[item.volume.id] : undefined;
  const pageIndex = personal && personal.updatedAt >= (Date.parse(item.updated_at ?? "") || 0) ? personal.pageIndex : item.page_index;
  const percent = Math.max(1, Math.min(100, Math.round(((pageIndex + 1) / pageCount) * 100)));
  const previewUsesPage = previewMode === "page" && !!item.page_path;

  return (
    <Link
      to="/ler/$volumeId"
      params={{ volumeId: item.volume_id }}
      className={`group flex w-full min-w-0 items-center gap-3 border border-border/50 p-2.5 transition hover:border-border/80 hover:bg-background/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-3 ${
        realistic
          ? "realistic-reading-item rounded-[9px] bg-background/28 lg:border-white/[.035] lg:bg-black/[.06]"
          : "rounded-2xl bg-background/35 lg:border-transparent lg:bg-transparent"
      } ${className ?? ""}`}
    >
      <div className="w-14 shrink-0 overflow-hidden rounded-xl border border-border/50 shadow-sm [&_.book-cover]:rounded-none sm:w-12">
        <PublicationCover
          coverUrl={previewUsesPage ? null : item.volume.cover_url ?? item.manga.cover_url}
          fallbackPagePath={previewUsesPage ? item.page_path : undefined}
          fallbackCoverUrl={item.volume.cover_url ?? item.manga.cover_url}
          title={item.manga.title}
          workType={item.manga.work_type}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold">{item.manga.title}</h3>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
          {unitLabel(item.volume.unit_kind)} {item.volume.number} · pág. {pageIndex + 1} de {pageCount}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-[9px] tabular-nums text-muted-foreground">{percent}%</span>
        </div>
      </div>

      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition group-hover:border-primary/30 group-hover:text-primary sm:size-8">
        <Play className="size-3 fill-current" />
      </span>
    </Link>
  );
}

export function LatestUpdatesHero({
  updates,
  workType,
  realistic = false,
}: {
  updates: LatestUpdateItem[];
  workType: WorkType | "all";
  realistic?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!updates.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > updates.length - 1) setActiveIndex(0);
  }, [activeIndex, updates.length]);

  useEffect(() => {
    if (updates.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % updates.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [updates.length]);

  if (!updates.length) {
    return (
      <div className={`relative min-h-[320px] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_78%_20%,var(--background-glow),transparent_35%),linear-gradient(125deg,rgba(9,11,16,.98),rgba(23,27,37,.9))] shadow-[0_32px_90px_-42px_rgba(0,0,0,.98)] lg:h-full lg:min-h-0 ${
        realistic ? "realistic-hero rounded-[14px]" : "rounded-[1.35rem] sm:rounded-[1.7rem]"
      }`}>
        <div className="relative z-10 flex min-h-[320px] max-w-2xl flex-col justify-end p-5 sm:min-h-[360px] sm:p-9 lg:h-full lg:min-h-0">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/85 uppercase backdrop-blur">
            <Sparkles className="size-3.5" /> Últimas atualizações
          </span>
          <h1 className="max-w-xl font-display text-3xl font-semibold sm:text-5xl leading-[0.96] tracking-tight text-white sm:text-5xl">
            Tudo em dia por aqui.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/65 sm:text-base">
            {workType === "book"
              ? "Nenhum livro recebeu novidades nos últimos 3 dias."
              : workType === "hq"
                ? "Nenhuma HQ recebeu novidades nos últimos 3 dias."
                : workType === "gibi"
                  ? "Nenhum gibi recebeu novidades nos últimos 3 dias."
                  : workType === "manga"
                    ? "Nenhum mangá recebeu novidades nos últimos 3 dias."
                    : "Nenhum mangá, HQ, livro ou gibi recebeu novidades nos últimos 3 dias."}
          </p>
        </div>
      </div>
    );
  }

  const safeActiveIndex = Math.min(activeIndex, updates.length - 1);
  const update = updates[safeActiveIndex]!;
  const typeLabel = workTypeSingular(update.manga.work_type);
  const heroCover = update.manga.cover_url;

  const goPrevious = () => {
    setActiveIndex((current) => (current - 1 + updates.length) % updates.length);
  };

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % updates.length);
  };

  return (
    <div
      className="relative min-h-[320px] sm:min-h-[360px] lg:h-full lg:min-h-0"
      onPointerMove={(event) => {
        if (!realistic || event.pointerType === "touch") return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 6;
        setParallax({ x, y });
      }}
      onPointerLeave={() => setParallax({ x: 0, y: 0 })}
    >
      <Link
        to="/manga/$slug"
        params={{ slug: update.manga.slug }}
        search={{ invite: "" }}
        aria-label={`Abrir ${update.manga.title}`}
        className={`group relative block h-full min-h-[320px] overflow-hidden border border-white/10 bg-black shadow-[0_32px_90px_-42px_rgba(0,0,0,.98)] transition duration-300 hover:border-white/20 hover:shadow-[0_36px_100px_-40px_rgba(0,0,0,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:min-h-0 ${
          realistic ? "realistic-hero rounded-[14px]" : "rounded-[1.35rem] sm:rounded-[1.7rem]"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden [&_.book-cover]:h-full [&_.book-cover]:w-full [&_.book-cover]:rounded-none [&_.book-cover]:object-cover">
          <div
            className="absolute -inset-3 transition-[transform,filter] duration-500 ease-out group-hover:scale-[1.025]"
            style={
              realistic
                ? { transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1.035)` }
                : undefined
            }
          >
            <PublicationCover coverUrl={heroCover} title={update.manga.title} workType={update.manga.work_type} />
          </div>
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,5,8,.97)_0%,rgba(4,5,8,.91)_26%,rgba(4,5,8,.70)_45%,rgba(4,5,8,.38)_66%,rgba(4,5,8,.16)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/10 to-black/26" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,214,102,.16),transparent_27%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,.07),transparent_30%)]" />
        {realistic ? <div className="pointer-events-none absolute inset-0 realistic-hero-vignette" /> : null}

        <div className="relative z-10 flex min-h-[320px] max-w-[84%] flex-col justify-end p-5 sm:min-h-[360px] sm:max-w-[58%] sm:p-8 lg:h-full lg:min-h-0 xl:p-9">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/90 uppercase backdrop-blur-md">
              <Sparkles className="size-3.5" /> Últimas atualizações
            </span>
            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-md">
              {typeLabel}
            </span>
          </div>

          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-white/55">
            <Clock3 className="size-3.5" /> {relativeUpdateDate(update.createdAt)}
          </p>
          <h1 className="line-clamp-2 max-w-2xl shrink-0 break-words font-display text-3xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
            {update.manga.title}
          </h1>
          <p className="mt-3 hidden max-w-xl shrink-0 overflow-hidden break-words text-sm leading-relaxed text-white/68 sm:line-clamp-3">
            {(() => {
              const text = (update.manga.synopsis ||
                `Confira ${update.manga.title}, uma das novidades mais recentes da sua biblioteca.`).trim();
              const limit = 210;
              return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
            })()}
          </p>
          <span className="mt-5 inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-white/16 bg-white px-5 py-2.5 text-sm font-semibold text-black transition group-hover:gap-3">
            <BookOpen className="size-4" /> Abrir {typeLabel.toLocaleLowerCase("pt-BR")}
          </span>
        </div>
      </Link>

      {updates.length > 1 ? (
        <div className="absolute bottom-5 right-5 z-30 flex items-center gap-2 sm:bottom-7 sm:right-7">
          <div className="mr-1 hidden items-center gap-1.5 sm:flex">
            {updates.slice(0, 6).map((item, index) => (
              <span
                key={item.id}
                className={`h-1.5 rounded-full transition-all ${
                  index === safeActiveIndex ? "w-5 bg-white" : "w-1.5 bg-white/35"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Novidade anterior"
            onClick={goPrevious}
            className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition hover:bg-white hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Próxima novidade"
            onClick={goNext}
            className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition hover:bg-white hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function HomeBookCard({
  manga,
  favorite,
  onToggleFavorite,
}: {
  manga: HomeManga;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="group relative w-[145px] shrink-0 snap-start sm:w-[160px] lg:w-[175px] xl:w-[185px] 2xl:w-[195px]">
      <div className="relative">
        <Link
          to="/manga/$slug"
          params={{ slug: manga.slug }}
          search={{ invite: "" }}
          aria-label={`Abrir ${manga.title}`}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="relative aspect-[2/3] overflow-hidden rounded-[0.45rem] border border-border/55 bg-card shadow-[0_22px_44px_-24px_rgba(0,0,0,.95)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_28px_55px_-24px_rgba(0,0,0,1)] [&_.book-cover]:h-full [&_.book-cover]:w-full [&_.book-cover]:rounded-none [&_.book-cover]:object-cover">
            <PublicationCover coverUrl={manga.cover_url} title={manga.title} workType={manga.work_type} />
          </div>
        </Link>

        <button
          type="button"
          aria-label={favorite ? `Remover ${manga.title} dos favoritos` : `Favoritar ${manga.title}`}
          title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          onClick={onToggleFavorite}
          className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full border border-white/15 bg-black/45 text-white opacity-0 shadow-lg backdrop-blur-md transition hover:bg-black/70 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:opacity-100"
        >
          <Heart className={`size-4 ${favorite ? "fill-primary text-primary" : ""}`} />
        </button>
      </div>

      <Link
        to="/manga/$slug"
        params={{ slug: manga.slug }}
        search={{ invite: "" }}
        className="mt-3 block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <h2 className="line-clamp-2 min-h-[2.5rem] max-h-[2.5rem] overflow-hidden break-words text-sm font-medium leading-5 text-foreground transition group-hover:text-primary sm:text-[15px]">
          {manga.title}
        </h2>
        <p className="mt-1 line-clamp-1 min-h-4 overflow-hidden text-xs italic text-muted-foreground">
          {manga.author || "Autor desconhecido"}
        </p>
        <p className="mt-1 text-xs font-semibold text-primary">
          {Number(manga.price_cents) >= 100
            ? formatMarketplacePrice(manga.price_cents, manga.currency)
            : "Grátis"}
        </p>
      </Link>
    </article>
  );
}

export function HomeLibraryCard({
  manga,
  favorite,
  onToggleFavorite,
}: {
  manga: HomeManga;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const typeLabel = WORK_TYPES.find((type) => type.value === manga.work_type)?.label ?? "Mangá";

  return (
    <article className="group relative w-[160px] shrink-0 snap-start sm:w-[180px] lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)] 2xl:w-[calc((100%-5rem)/6)]">
      <Link
        to="/manga/$slug"
        params={{ slug: manga.slug }}
        search={{ invite: "" }}
        className="block overflow-hidden rounded-[1.3rem] border border-border/60 bg-card/70 shadow-[0_20px_50px_-30px_rgba(0,0,0,.95)] transition duration-300 hover:-translate-y-1 hover:border-primary/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="relative aspect-[7/10] overflow-hidden">
          <PublicationCover coverUrl={manga.cover_url} title={manga.title} workType={manga.work_type} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(4,5,8,.96)_0%,rgba(4,5,8,.42)_38%,transparent_67%)]" />

          <div className="absolute left-3 top-3">
            <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-white/85 uppercase backdrop-blur">
              {typeLabel}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3.5">
            <p className="line-clamp-1 text-[10px] text-white/55">
              {manga.genres.slice(0, 2).join(" · ") || "Biblioteca"}
            </p>
            <h2 className="mt-1 line-clamp-2 min-h-10 max-h-10 overflow-hidden break-words text-sm font-semibold leading-5 text-white sm:text-[15px]">
              {manga.title}
            </h2>
            <p className="mt-1 truncate text-[10px] text-white/55">
              {manga.author || "Autor desconhecido"}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-white">
              {Number(manga.price_cents) >= 100
                ? formatMarketplacePrice(manga.price_cents, manga.currency)
                : "Grátis"}
            </p>
          </div>
        </div>
      </Link>

      <button
        type="button"
        aria-label={favorite ? `Remover ${manga.title} dos favoritos` : `Favoritar ${manga.title}`}
        title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        onClick={onToggleFavorite}
        className="absolute right-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-full border border-white/12 bg-black/55 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Heart className={`size-4 ${favorite ? "fill-primary text-primary" : ""}`} />
      </button>
    </article>
  );
}

function formatReadingDuration(totalSeconds: number) {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60);
  if (totalMinutes < 60) return `${totalMinutes}min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function workTypeSingular(workType: WorkType) {
  if (workType === "hq") return "HQ";
  if (workType === "gibi") return "Gibi";
  if (workType === "book") return "Livro";
  return "Mangá";
}

function relativeUpdateDate(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Atualizado hoje";
  if (days === 1) return "Atualizado ontem";
  return `Atualizado há ${days} dias`;
}
