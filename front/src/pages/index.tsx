import { getReaderPages } from "@/lib/readerPages";
import { useCatalogDisplayPreferences } from "@/hooks/useCatalogDisplayPreferences";
import { Route } from "@/routes/index";
import { DailyReadingCard, ContinueReadingRail, LatestUpdatesHero, HomeBookCard, HomeLibraryCard, MobileQuickActions } from "@/components/HomeSections";
import { MobileReadingStreak } from "@/components/MobileReadingStreak";
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
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { CatalogDisplayCard } from "@/components/CatalogDisplayCard";
import { MangaCardSkeleton, MangaCover, type MangaSummary } from "@/components/MangaCard";
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
import { getCatalogDisplayStyle } from "@/lib/catalogDisplay";
import { WORK_TYPES, type WorkType, unitLabel } from "@/lib/publication";
import { formatMarketplacePrice } from "@/lib/marketplace";

export type HomeManga = MangaSummary & {
  catalog_sale_enabled?: boolean;
  work_type: WorkType;
  synopsis: string;
  created_at: string;
};

export type ContinueReadingItem = {
  volume_id: string;
  page_index: number;
  updated_at: string | null;
  volume: {
    id: string;
    number: number;
    unit_kind: "volume" | "chapter";
    file_format: string;
    page_count: number;
    cover_url: string | null;
    manga_id: string;
  };
  manga: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    author: string;
    genres: string[];
    work_type: WorkType;
    synopsis: string | null;
  };
  page_path: string | null;
};

type RecentVolume = {
  id: string;
  manga_id: string;
  number: number;
  unit_kind: "volume" | "chapter";
  cover_url: string | null;
  created_at: string;
  title: string;
};

export type LatestUpdateItem = {
  id: string;
  createdAt: string;
  manga: HomeManga;
};

const UPDATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function Index() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const catalogScrollerRef = useRef<HTMLDivElement>(null);
  const routeSearch = useRouterState({ select: (state) => state.location.search }) as Record<
    string,
    unknown
  >;
  const routeQuery = typeof routeSearch['q'] === "string" ? routeSearch['q'] : "";
  const routeWorkType = WORK_TYPES.some((item) => item.value === routeSearch['type'])
    ? (routeSearch['type'] as WorkType)
    : "all";
  const routeFavorites =
    routeSearch['favorites'] === true ||
    routeSearch['favorites'] === "true" ||
    routeSearch['favorites'] === 1 ||
    routeSearch['favorites'] === "1";

  const [search, setSearch] = useState(routeQuery);
  const [workType, setWorkType] = useState<WorkType | "all">("all");
  const [genre, setGenre] = useState("all");
  const [order, setOrder] = useState<"popular" | "az" | "za">("popular");
  const [favoritesOnly, setFavoritesOnly] = useState(routeFavorites);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [continuePreviewMode, setContinuePreviewMode] = useState<ContinueReadingPreview>(() =>
    getStoredContinueReadingPreview(),
  );
  const catalogDisplayPreferences = useCatalogDisplayPreferences();

  useEffect(() => {
    setSearch(routeQuery);
    setWorkType("all");
    setFavoritesOnly(routeFavorites);
  }, [routeFavorites, routeQuery, routeWorkType]);

  useEffect(() => {
    const syncMode = () => setContinuePreviewMode(getStoredContinueReadingPreview());
    syncMode();
    window.addEventListener("storage", syncMode);
    window.addEventListener("focus", syncMode);
    return () => {
      window.removeEventListener("storage", syncMode);
      window.removeEventListener("focus", syncMode);
    };
  }, []);

  const { data: mangas = [], isLoading } = useQuery({
    queryKey: ["mangas"],
    queryFn: async () => {
      const withPopularity = await supabase
        .from("mangas")
        .select(
          "id, slug, title, author, cover_url, genres, price_cents, currency, catalog_sale_enabled, work_type, synopsis, view_count, created_at",
        )
        .eq("visibility", "public")
        .eq("distribution_channel", "catalog")
        .order("view_count", { ascending: false })
        .order("title");

      if (!withPopularity.error) return (withPopularity.data ?? []) as HomeManga[];
      if (!withPopularity.error.message.includes("view_count")) throw withPopularity.error;

      const fallback = await supabase
        .from("mangas")
        .select(
          "id, slug, title, author, cover_url, genres, price_cents, currency, catalog_sale_enabled, work_type, synopsis, created_at",
        )
        .eq("visibility", "public")
        .eq("distribution_channel", "catalog")
        .order("title");
      if (fallback.error) throw fallback.error;

      return (fallback.data ?? []).map((manga) => ({
        ...manga,
        work_type: manga.work_type as WorkType,
        view_count: 0,
      })) as HomeManga[];
    },
  });

  const { data: recentVolumes = [] } = useQuery({
    queryKey: ["home-recent-volumes"],
    queryFn: async () => {
      const since = new Date(Date.now() - UPDATE_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from("volumes")
        .select("id, manga_id, number, unit_kind, cover_url, created_at, title")
        .eq("published", true)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;

      return (data ?? []).map((volume) => ({
        ...volume,
        unit_kind: volume.unit_kind === "chapter" ? "chapter" : "volume",
      })) satisfies RecentVolume[];
    },
  });

  const latestUpdates = useMemo(() => {
    const since = Date.now() - UPDATE_WINDOW_MS;
    const mangaById = new Map(mangas.map((manga) => [manga.id, manga]));
    const latestByManga = new Map<string, LatestUpdateItem>();

    // Obras novas entram diretamente nos destaques.
    mangas
      .filter((manga) => new Date(manga.created_at).getTime() >= since)
      .forEach((manga) => {
        latestByManga.set(manga.id, {
          id: `work-${manga.id}`,
          createdAt: manga.created_at,
          manga,
        });
      });

    // Um novo volume/capítulo apenas faz a OBRA voltar para os destaques.
    // O destaque nunca representa o volume/capítulo individualmente.
    recentVolumes.forEach((volume) => {
      const manga = mangaById.get(volume.manga_id);
      if (!manga) return;

      const current = latestByManga.get(manga.id);
      if (!current || new Date(volume.created_at).getTime() > new Date(current.createdAt).getTime()) {
        latestByManga.set(manga.id, {
          id: `work-${manga.id}`,
          createdAt: volume.created_at,
          manga,
        });
      }
    });

    return [...latestByManga.values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [mangas, recentVolumes]);

  const visibleLatestUpdates = useMemo(
    () =>
      workType === "all"
        ? latestUpdates
        : latestUpdates.filter((item) => item.manga.work_type === workType),
    [latestUpdates, workType],
  );

  const { data: favoriteRows = [] } = useQuery({
    queryKey: ["manga-favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manga_favorites")
        .select("manga_id")
        .eq("user_id", user!.id);
      if (error) {
        if (error.message.includes("manga_favorites")) return [];
        throw error;
      }
      return data ?? [];
    },
  });

  const favoriteIds = useMemo(
    () => new Set(favoriteRows.map((favorite) => favorite.manga_id)),
    [favoriteRows],
  );

  const toggleFavorite = useMutation({
    mutationFn: async ({ mangaId, favorite }: { mangaId: string; favorite: boolean }) => {
      if (!user) throw new Error("Entre na sua conta para favoritar obras.");
      const result = favorite
        ? await supabase.from("manga_favorites").delete().eq("user_id", user.id).eq("manga_id", mangaId)
        : await supabase.from("manga_favorites").insert({ user_id: user.id, manga_id: mangaId });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["manga-favorites", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const genres = useMemo(
    () =>
      [...new Set(mangas.flatMap((manga) => manga.genres).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [mangas],
  );

  const filteredMangas = useMemo(() => {
    const term = search
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");

    return mangas
      .filter((manga) => {
        if (workType !== "all" && manga.work_type !== workType) return false;
        if (genre !== "all" && !manga.genres.includes(genre)) return false;
        if (favoritesOnly && !favoriteIds.has(manga.id)) return false;
        if (!term) return true;
        const searchable = [manga.title, manga.author, ...manga.genres]
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("pt-BR");
        return searchable.includes(term);
      })
      .sort((a, b) => {
        if (order === "az") return a.title.localeCompare(b.title, "pt-BR");
        if (order === "za") return b.title.localeCompare(a.title, "pt-BR");
        return (b.view_count ?? 0) - (a.view_count ?? 0) || a.title.localeCompare(b.title, "pt-BR");
      });
  }, [favoriteIds, favoritesOnly, genre, mangas, order, search, workType]);

  const { data: hasReadingHistory = false } = useQuery({
    queryKey: ["has-reading-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_progress")
        .select("volume_id")
        .eq("user_id", user!.id)
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });

  const { data: continueReading = [] } = useQuery({
    queryKey: ["continue-reading", user?.id, continuePreviewMode],
    enabled: !!user,
    queryFn: async () => {
      const { data: progress, error: progressError } = await supabase
        .from("reading_progress")
        .select("volume_id, page_index, completed_at, updated_at")
        .eq("user_id", user!.id)
        .is("completed_at", null)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (progressError) throw progressError;
      if (!progress?.length) return [];

      const { data: volumes, error: volumesError } = await supabase
        .from("volumes")
        .select("id, number, unit_kind, file_format, page_count, cover_url, manga_id")
        .in(
          "id",
          progress.map((item) => item.volume_id),
        );
      if (volumesError) throw volumesError;

      const mangaIds = [...new Set((volumes ?? []).map((volume) => volume.manga_id))];
      const { data: mangaRows, error: mangaError } = await supabase
        .from("mangas")
        .select("id, title, slug, cover_url, author, genres, work_type, synopsis")
        .in("id", mangaIds);
      if (mangaError) throw mangaError;

      const pagePathMap = new Map<string, string | null>();
      if (continuePreviewMode === "page") {
        await Promise.all(
          progress.map(async (item) => {
            const pages = await getReaderPages([item.volume_id], item.page_index);
            pagePathMap.set(item.volume_id, pages[0]?.storage_path ?? null);
          }),
        );
      }

      return progress.flatMap((item) => {
        const volume = volumes?.find((row) => row.id === item.volume_id);
        const manga = mangaRows?.find((row) => row.id === volume?.manga_id);
        if (
          !volume ||
          !manga ||
          (volume.file_format !== "epub" && item.page_index + 1 >= volume.page_count)
        )
          return [];

        return [
          {
            ...item,
            volume: {
              ...volume,
              unit_kind: volume.unit_kind === "chapter" ? "chapter" : "volume",
            },
            manga: {
              ...manga,
              author: manga.author ?? "",
              genres: manga.genres ?? [],
              work_type: (manga.work_type ?? "manga") as WorkType,
              synopsis: manga.synopsis ?? null,
            },
            page_path: pagePathMap.get(item.volume_id) ?? null,
          } satisfies ContinueReadingItem,
        ];
      });
    },
  });

  const todayReadingDate = useMemo(() => saoPauloDateKey(new Date()), []);

  const { data: readingStreak = { days: 0, activeToday: false } } = useQuery({
    queryKey: ["reading-streak", user?.id, todayReadingDate],
    enabled: !!user,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_time_daily")
        .select("reading_date, seconds_read")
        .eq("user_id", user!.id)
        .gt("seconds_read", 0)
        .order("reading_date", { ascending: false })
        .limit(400);
      if (error) {
        if (error.message.includes("reading_time_daily")) return { days: 0, activeToday: false };
        throw error;
      }
      const dates = new Set((data ?? []).map((row) => row.reading_date));
      const activeToday = dates.has(todayReadingDate);
      const cursor = new Date(`${todayReadingDate}T12:00:00-03:00`);
      if (!activeToday) cursor.setDate(cursor.getDate() - 1);
      let days = 0;
      while (true) {
        const key = saoPauloDateKey(cursor);
        if (!dates.has(key)) break;
        days += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return { days, activeToday };
    },
  });

  const { data: dailyReadingSeconds = 0 } = useQuery({
    queryKey: ["reading-time-today", user?.id, todayReadingDate],
    enabled: !!user,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_time_daily")
        .select("seconds_read")
        .eq("user_id", user!.id)
        .eq("reading_date", todayReadingDate);

      if (error) {
        // Mantém a Home funcionando antes da migration ser aplicada.
        if (error.message.includes("reading_time_daily")) return 0;
        throw error;
      }

      return (data ?? []).reduce((total, item) => total + Math.max(0, item.seconds_read ?? 0), 0);
    },
  });

  const { data: donation } = useQuery({
    queryKey: ["donations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "donations")
        .maybeSingle();
      if (error) {
        if (error.message.includes("site_settings")) return null;
        throw error;
      }
      const value = data?.value;
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const rawLink = typeof value["link_url"] === "string" ? value["link_url"] : "";
      let linkUrl: string | null = null;
      try {
        const parsedLink = new URL(rawLink);
        linkUrl = parsedLink.protocol === "https:" ? parsedLink.toString() : null;
      } catch {
        linkUrl = null;
      }
      return {
        enabled: value["enabled"] === true,
        // Atualiza também o texto padrão salvo antes da mudança de marca.
        message:
          typeof value["message"] === "string" &&
          value["message"] !== "Ajude a manter o Mangaka online."
            ? value["message"]
            : "Ajude a manter o BookSyde online.",
        qrUrl: typeof value["qr_url"] === "string" ? value["qr_url"] : null,
        linkUrl,
      };
    },
  });

  function requestFavorite(mangaId: string) {
    if (!user) {
      toast.info("Entre na sua conta para salvar favoritos.");
      void navigate({ to: "/auth" });
      return;
    }
    toggleFavorite.mutate({ mangaId, favorite: favoriteIds.has(mangaId) });
  }

  function scrollCatalog(direction: "prev" | "next") {
    catalogScrollerRef.current?.scrollBy({
      left: direction === "next" ? 560 : -560,
      behavior: "smooth",
    });
  }

  function selectCatalogType(nextType: WorkType | "all") {
    setWorkType(nextType);

    void navigate({
      to: "/",
      search: {
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(nextType !== "all" ? { type: nextType } : {}),
        ...(favoritesOnly ? { favorites: true } : {}),
      },
      replace: true,
    });
  }

  const showReadingSidebar = !!user && hasReadingHistory;
  const realisticSceneActive =
    workType === "all"
      ? Object.values(catalogDisplayPreferences).some((style) => style === "realistic")
      : getCatalogDisplayStyle(catalogDisplayPreferences, workType) === "realistic";

  return (
    <main
      data-home-style={realisticSceneActive ? "realistic" : "default"}
      className={`w-full pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-24 ${
        realisticSceneActive ? "realistic-home-scene" : ""
      }`}
    >
      <section className="mx-auto w-full px-3 pt-3 sm:px-4 sm:pt-5 lg:px-6 xl:px-8 2xl:px-10">
        {user ? (
          <div className="mb-3 sm:hidden">
            <MobileQuickActions signedIn />
          </div>
        ) : null}

        {user ? (
          <div className="mb-3 sm:hidden" data-tour="home-streak">
            <MobileReadingStreak days={readingStreak.days} activeToday={readingStreak.activeToday} />
          </div>
        ) : null}

        <div
          className={
            showReadingSidebar
              ? "grid grid-cols-1 gap-4 lg:grid-cols-[285px_minmax(0,1fr)] lg:items-stretch lg:gap-5 xl:grid-cols-[315px_minmax(0,1fr)] 2xl:grid-cols-[335px_minmax(0,1fr)]"
              : "grid grid-cols-1 gap-4"
          }
        >
          {showReadingSidebar ? (
            <div data-tour="home-continue" className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-full lg:gap-4">
              {continueReading.length ? (
                <ContinueReadingRail
                  items={continueReading}
                  previewMode={continuePreviewMode}
                  signedIn
                  realistic={realisticSceneActive}
                />
              ) : null}
              <DailyReadingCard seconds={dailyReadingSeconds} signedIn realistic={realisticSceneActive} />
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-6 lg:gap-7">
            {visibleLatestUpdates.length > 0 ? (
              <div data-tour="home-latest" className="min-h-[320px] sm:min-h-[360px] lg:h-[500px] lg:min-h-0 xl:h-[520px] 2xl:h-[550px]">
                <LatestUpdatesHero updates={visibleLatestUpdates} workType={workType} realistic={realisticSceneActive} />
              </div>
            ) : null}

            <section
              id="catalogo"
              data-tour="home-catalog"
              data-realistic={realisticSceneActive ? "true" : "false"}
              className={`min-w-0 ${realisticSceneActive ? "realistic-catalog-section" : ""}`}
            >
              <div className="mb-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-[1.7rem] font-semibold tracking-tight sm:text-[2rem]">
                    Catálogo
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {filteredMangas.length} {filteredMangas.length === 1 ? "obra encontrada" : "obras encontradas"}
                  </p>


                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant={filtersOpen ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFiltersOpen((current) => !current)}
                    className="h-9 rounded-full px-3 text-xs"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Filtros
                  </Button>
                  <div className="hidden items-center gap-2 sm:flex">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="Voltar na biblioteca"
                      onClick={() => scrollCatalog("prev")}
                      className="size-9 rounded-full bg-card/70 backdrop-blur"
                    >
                      <ArrowLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="Avançar na biblioteca"
                      onClick={() => scrollCatalog("next")}
                      className="size-9 rounded-full bg-card/70 backdrop-blur"
                    >
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {filtersOpen ? (
                <div className="mb-4 rounded-2xl border border-border/55 bg-card/45 p-2.5 backdrop-blur-xl">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_repeat(3,minmax(135px,.6fr))_auto] xl:items-center">
                    <label className="relative block min-w-0">
                      <span className="sr-only">Pesquisar por nome, autor ou gênero</span>
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar título, autor ou gênero"
                        className="h-10 rounded-xl border-border/45 bg-background/45 pl-10"
                      />
                    </label>

                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger className="h-10 rounded-xl border-border/45 bg-background/45">
                        <SelectValue placeholder="Gênero" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os gêneros</SelectItem>
                        {genres.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={order} onValueChange={(value) => setOrder(value as "popular" | "az" | "za")}>
                      <SelectTrigger className="h-10 rounded-xl border-border/45 bg-background/45">
                        <SelectValue placeholder="Ordenar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="popular">Mais acessados</SelectItem>
                        <SelectItem value="az">Nome: A–Z</SelectItem>
                        <SelectItem value="za">Nome: Z–A</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant={favoritesOnly ? "default" : "outline"}
                      onClick={() => {
                        if (!user) {
                          toast.info("Entre na sua conta para ver seus favoritos.");
                          void navigate({ to: "/auth" });
                          return;
                        }
                        setFavoritesOnly((current) => !current);
                      }}
                      className="h-10 rounded-xl px-4"
                    >
                      <Heart className={favoritesOnly ? "fill-current" : ""} />
                      Favoritos
                    </Button>
                  </div>
                </div>
              ) : null}

              <p className="mb-3 text-xs text-muted-foreground sm:hidden">Deslize para ver mais</p>

              {isLoading ? (
                <div className="flex gap-3 overflow-hidden pb-3 sm:gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-[270px] w-[178px] shrink-0 sm:h-[320px] sm:w-[210px]">
                      <MangaCardSkeleton className="h-full" />
                    </div>
                  ))}
                </div>
              ) : filteredMangas.length ? (
                <div
                  ref={catalogScrollerRef}
                  className={`flex w-full snap-x snap-mandatory overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                    realisticSceneActive ? "realistic-catalog-surface pb-9 pt-2" : "pb-4"
                  } ${
                    workType === "book" ? "gap-7 sm:gap-8 lg:gap-10" : "gap-3 sm:gap-4"
                  }`}
                >
                  {filteredMangas.map((manga, index) => {
                    const displayStyle = getCatalogDisplayStyle(
                      catalogDisplayPreferences,
                      manga.work_type,
                    );

                    if (displayStyle !== "grid") {
                      return (
                        <div
                          key={manga.id}
                          className="w-[44vw] min-w-[142px] max-w-[168px] shrink-0 snap-start sm:w-[170px] sm:max-w-none lg:w-[185px] xl:w-[195px]"
                        >
                          <CatalogDisplayCard
                            manga={manga}
                            style={displayStyle}
                            favorite={favoriteIds.has(manga.id)}
                            onToggleFavorite={() => requestFavorite(manga.id)}
                            index={index}
                          />
                        </div>
                      );
                    }

                    return workType === "book" ? (
                      <HomeBookCard
                        key={manga.id}
                        manga={manga}
                        favorite={favoriteIds.has(manga.id)}
                        onToggleFavorite={() => requestFavorite(manga.id)}
                      />
                    ) : (
                      <HomeLibraryCard
                        key={manga.id}
                        manga={manga}
                        favorite={favoriteIds.has(manga.id)}
                        onToggleFavorite={() => requestFavorite(manga.id)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 px-4 py-14 text-center">
                  <Library className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-4 text-base font-semibold">Nenhuma obra encontrada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ajuste a busca ou remova algum filtro para encontrar seus arquivos.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>

      {donation?.enabled && (donation.qrUrl || donation.linkUrl) ? (
        <section className="mx-3 mt-10 max-w-[1920px] overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] sm:mx-4 sm:flex sm:items-center sm:justify-between sm:rounded-3xl sm:p-8 lg:mx-6 xl:mx-8 2xl:mx-auto">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Heart className="size-4" /> Apoie o BookSyde
            </p>
            <h2 className="mt-2 font-display text-2xl">Ajude a manter a plataforma</h2>
            <p className="mt-2 text-sm text-muted-foreground">{donation.message}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {donation.qrUrl
                ? "Leia o QR Code ou abra a página segura do LivePix."
                : "Abra a página segura do LivePix para fazer sua doação."}
            </p>
            {donation.linkUrl ? (
              <Button className="mt-5" asChild>
                <a href={donation.linkUrl} target="_blank" rel="noopener noreferrer">
                  Doar pelo LivePix <ExternalLink className="size-4" />
                </a>
              </Button>
            ) : null}
          </div>
          {donation.qrUrl ? (
            <img
              src={donation.qrUrl}
              alt="QR Code para doação via LivePix"
              className="mx-auto mt-5 size-44 rounded-2xl border bg-white p-2 sm:mx-0 sm:mt-0"
            />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function saoPauloDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

