import { useCatalogDisplayPreferences } from "@/hooks/useCatalogDisplayPreferences";
import { Route } from "@/routes/biblioteca";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookCheck, BookOpen, Download, Heart, Library, PenLine, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { LibraryCollections } from "@/components/LibraryCollections";
import { CatalogDisplayCard } from "@/components/CatalogDisplayCard";
import { MangaCard, MangaCardSkeleton, type MangaSummary } from "@/components/MangaCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";
import {
  getCatalogDisplayStyle,
  type CatalogDisplayPreferences,
} from "@/lib/catalogDisplay";
import {
  getOfflineVolume,
  getOfflineVolumeIds,
  removeOfflineVolume,
  type OfflineVolume,
} from "@/lib/offlineVolumes";
import { cn } from "@/lib/utils";

type LibraryTabValue = "all" | "progress" | "completed" | "favorites" | "creations";

type LibraryData = {
  all: MangaSummary[];
  completed: MangaSummary[];
  creations: MangaSummary[];
  inProgress: MangaSummary[];
  favorites: MangaSummary[];
};

const EMPTY_LIBRARY: LibraryData = {
  all: [],
  completed: [],
  creations: [],
  inProgress: [],
  favorites: [],
};

export function LibraryPage() {
  const search = Route.useSearch();
  const tab: LibraryTabValue = search.tab ?? "all";
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const [offlineVolumes, setOfflineVolumes] = useState<OfflineVolume[]>([]);
  const catalogDisplayPreferences = useCatalogDisplayPreferences();

  useEffect(() => {
    const refresh = () =>
      setOfflineVolumes(
        getOfflineVolumeIds().flatMap((id) => {
          const volume = getOfflineVolume(id);
          return volume ? [volume] : [];
        }),
      );
    refresh();
    window.addEventListener("mangaka-offline-updated", refresh);
    return () => window.removeEventListener("mangaka-offline-updated", refresh);
  }, []);

  const {
    data = EMPTY_LIBRARY,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["personal-library", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LibraryData> => {
      const [progressResult, favoritesResult, creationsResult] = await Promise.all([
        supabase.from("reading_progress").select("volume_id, completed_at").eq("user_id", user!.id),
        supabase.from("manga_favorites").select("manga_id").eq("user_id", user!.id),
        supabase.from("mangas").select("id").eq("creator_id", user!.id),
      ]);
      if (progressResult.error) throw progressResult.error;
      if (favoritesResult.error && !favoritesResult.error.message.includes("manga_favorites"))
        throw favoritesResult.error;
      if (creationsResult.error) throw creationsResult.error;

      const progressedVolumeIds = (progressResult.data ?? []).map((row) => row.volume_id);
      const progressedVolumes = progressedVolumeIds.length
        ? await supabase.from("volumes").select("id, manga_id").in("id", progressedVolumeIds)
        : { data: [], error: null };
      if (progressedVolumes.error) throw progressedVolumes.error;
      const progressMangaIds = [
        ...new Set((progressedVolumes.data ?? []).map((row) => row.manga_id)),
      ];
      const allVolumes = progressMangaIds.length
        ? await supabase.from("volumes").select("id, manga_id").in("manga_id", progressMangaIds)
        : { data: [], error: null };
      if (allVolumes.error) throw allVolumes.error;

      const favoriteIds = (favoritesResult.data ?? []).map((row) => row.manga_id);
      const creationIds = (creationsResult.data ?? []).map((row) => row.id);
      const allMangaIds = [...new Set([...progressMangaIds, ...favoriteIds, ...creationIds])];
      if (!allMangaIds.length) return EMPTY_LIBRARY;

      const { data: mangaRows, error: mangaError } = await supabase
        .from("mangas")
        .select(
          "id, slug, title, author, cover_url, genres, price_cents, currency, work_type, view_count, creator_id",
        )
        .in("id", allMangaIds)
        .order("title");
      if (mangaError) throw mangaError;

      const mangas = (mangaRows ?? []) as MangaSummary[];
      const mangaById = new Map(mangas.map((manga) => [manga.id, manga]));
      const completedVolumeIds = new Set(
        (progressResult.data ?? [])
          .filter((row) => Boolean(row.completed_at))
          .map((row) => row.volume_id),
      );
      const activeVolumeIds = new Set(
        (progressResult.data ?? []).filter((row) => !row.completed_at).map((row) => row.volume_id),
      );
      const volumesByManga = new Map<string, string[]>();
      for (const volume of allVolumes.data ?? []) {
        volumesByManga.set(volume.manga_id, [
          ...(volumesByManga.get(volume.manga_id) ?? []),
          volume.id,
        ]);
      }
      const inProgressIds = new Set(
        (progressedVolumes.data ?? [])
          .filter((volume) => activeVolumeIds.has(volume.id))
          .map((volume) => volume.manga_id),
      );
      const completedMangaIds = progressMangaIds.filter((mangaId) => {
        const volumeIds = volumesByManga.get(mangaId) ?? [];
        return volumeIds.length > 0 && volumeIds.every((id) => completedVolumeIds.has(id));
      });
      const resolve = (ids: string[]) =>
        ids.flatMap((id) => (mangaById.has(id) ? [mangaById.get(id)!] : []));
      return {
        all: mangas,
        completed: resolve(completedMangaIds),
        creations: resolve(creationIds),
        inProgress: resolve([...inProgressIds]),
        favorites: resolve(favoriteIds),
      };
    },
  });

  const favoriteIds = useMemo(() => new Set(data.favorites.map((manga) => manga.id)), [data.favorites]);

  const toggleFavorite = useMutation({
    mutationFn: async ({ mangaId, favorite }: { mangaId: string; favorite: boolean }) => {
      if (!user) throw new Error("Entre na sua conta para favoritar obras.");
      const result = favorite
        ? await supabase
            .from("manga_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("manga_id", mangaId)
        : await supabase.from("manga_favorites").insert({ user_id: user.id, manga_id: mangaId });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal-library", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["manga-favorites", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const summary = useMemo(
    () => [
      {
        label: "Em andamento",
        value: data.inProgress.length,
        icon: <BookOpen className="size-3.5" />,
      },
      { label: "Concluídos", value: data.completed.length, icon: <BookCheck className="size-3.5" /> },
      { label: "Favoritos", value: data.favorites.length, icon: <Heart className="size-3.5" /> },
      { label: "Criações", value: data.creations.length, icon: <PenLine className="size-3.5" /> },
    ],
    [data],
  );

  if (!loading && !user)
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">Entre para ver sua biblioteca</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Salve favoritos, acompanhe seu progresso e organize suas leituras em um só lugar.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </main>
    );

  return (
    <main className="mx-auto w-full px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pb-10 sm:pt-6 lg:px-6 xl:px-8 2xl:px-10">
      {isError ? (
        <div role="alert" className="mb-4 rounded-xl border p-4">
          Não foi possível carregar suas obras.{" "}
          <Button variant="link" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(value) =>
          void navigate({ search: { tab: value as LibraryTabValue }, replace: true })
        }
        className="min-w-0"
      >
        <div className="mb-3 lg:hidden">
          <div className="flex items-end justify-between gap-3 px-0.5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Minha biblioteca</p>
              <h1 className="mt-0.5 font-display text-[1.65rem] leading-tight">Biblioteca</h1>
            </div>
            <span className="shrink-0 rounded-full border border-border/60 bg-card/55 px-2.5 py-1 text-xs text-muted-foreground">
              {data.all.length} {data.all.length === 1 ? "obra" : "obras"}
            </span>
          </div>

          <TabsList
            data-tour="library-tabs"
            className="mt-3 flex h-auto w-full gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/55 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <LibraryTab compact value="all" icon={<Library />} label="Todos" />
            <LibraryTab compact value="progress" icon={<BookOpen />} label="Lendo" count={data.inProgress.length} />
            <LibraryTab compact value="completed" icon={<BookCheck />} label="Lidos" count={data.completed.length} />
            <LibraryTab compact value="favorites" icon={<Heart />} label="Favoritos" count={data.favorites.length} />
            <LibraryTab compact value="creations" icon={<PenLine />} label="Criações" count={data.creations.length} />
          </TabsList>
        </div>

        <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)] xl:gap-5">
          <aside className="hidden rounded-[1.4rem] border border-border/70 bg-card/70 p-3 shadow-[0_22px_54px_-40px_rgba(0,0,0,0.9)] backdrop-blur lg:sticky lg:top-[calc(6.2rem+env(safe-area-inset-top))] lg:block">
            <div className="px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Minha biblioteca</p>
              <h1 className="mt-1 font-display text-2xl">Biblioteca</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Organize leituras, favoritos e criações em um só lugar.
              </p>
            </div>

            <TabsList
              data-tour="library-tabs"
              className="mt-4 grid h-auto grid-cols-1 gap-1 bg-transparent p-0"
            >
              <LibraryTab value="all" icon={<Library />} label="Todos" />
              <LibraryTab
                value="progress"
                icon={<BookOpen />}
                label="Em andamento"
                count={data.inProgress.length}
              />
              <LibraryTab
                value="completed"
                icon={<BookCheck />}
                label="Lidos"
                count={data.completed.length}
              />
              <LibraryTab
                value="favorites"
                icon={<Heart />}
                label="Favoritos"
                count={data.favorites.length}
              />
              <LibraryTab
                value="creations"
                icon={<PenLine />}
                label="Minhas criações"
                count={data.creations.length}
              />
            </TabsList>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {summary.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1rem] border border-border/65 bg-background/45 px-3 py-2.5"
                >
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                    {item.icon}
                    {item.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </aside>

          <section className="min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[1.45rem] lg:border lg:border-border/70 lg:bg-card/55 lg:p-5 lg:shadow-[0_24px_60px_-42px_rgba(0,0,0,0.9)] lg:backdrop-blur">
            <TabsContent value="all" className="mt-0">
              <LibraryCollections
                mangas={data.all}
                loading={isLoading}
                favoriteIds={favoriteIds}
                onToggleFavorite={(mangaId) =>
                  toggleFavorite.mutate({ mangaId, favorite: favoriteIds.has(mangaId) })
                }
              />
            </TabsContent>
            <LibraryContent
              value="progress"
              mangas={data.inProgress}
              loading={isLoading}
              displayPreferences={catalogDisplayPreferences}
              favoriteIds={favoriteIds}
              onToggleFavorite={(mangaId) =>
                toggleFavorite.mutate({ mangaId, favorite: favoriteIds.has(mangaId) })
              }
              title="Em andamento"
              description="Continue de onde parou."
              emptyTitle="Nenhuma leitura em andamento"
              emptyText="Quando você começar um volume, a obra aparecerá aqui."
              action={
                <Button asChild>
                  <Link to="/">Explorar catálogo</Link>
                </Button>
              }
            />
            <LibraryContent
              value="completed"
              mangas={data.completed}
              loading={isLoading}
              displayPreferences={catalogDisplayPreferences}
              favoriteIds={favoriteIds}
              onToggleFavorite={(mangaId) =>
                toggleFavorite.mutate({ mangaId, favorite: favoriteIds.has(mangaId) })
              }
              title="Lidos"
              description="Tudo que você já concluiu."
              emptyTitle="Nenhuma obra concluída"
              emptyText="Uma obra aparecerá aqui quando todos os volumes estiverem marcados como lidos."
            />
            <LibraryContent
              value="favorites"
              mangas={data.favorites}
              loading={isLoading}
              displayPreferences={catalogDisplayPreferences}
              favoriteIds={favoriteIds}
              onToggleFavorite={(mangaId) =>
                toggleFavorite.mutate({ mangaId, favorite: favoriteIds.has(mangaId) })
              }
              title="Favoritos"
              description="Seus títulos guardados."
              emptyTitle="Nenhum favorito"
              emptyText="Use o coração no catálogo para guardar suas obras preferidas."
              action={
                <Button variant="outline" asChild>
                  <Link to="/">Encontrar mangás</Link>
                </Button>
              }
            />
            <LibraryContent
              value="creations"
              mangas={data.creations}
              loading={isLoading}
              displayPreferences={catalogDisplayPreferences}
              favoriteIds={favoriteIds}
              onToggleFavorite={(mangaId) =>
                toggleFavorite.mutate({ mangaId, favorite: favoriteIds.has(mangaId) })
              }
              title="Minhas criações"
              description="Obras publicadas por você."
              emptyTitle="Você ainda não criou mangás"
              emptyText="Crie sua primeira obra e escolha quem poderá acessá-la."
              action={
                <Button asChild>
                  <Link to="/studio" search={{ obra: "", aba: "criar" }}>
                    <Plus /> Criar mangá
                  </Link>
                </Button>
              }
            />
          </section>
        </div>
      </Tabs>

      {offlineVolumes.length ? (
        <section data-tour="library-offline" className="mt-5 rounded-[1.45rem] border border-primary/20 bg-card/70 p-4 shadow-[0_22px_54px_-34px_rgba(0,0,0,0.92)] backdrop-blur sm:p-5">
          <div className="flex items-center gap-2">
            <Download className="size-5 text-primary" />
            <h2 className="font-display text-xl">Disponíveis offline</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Seus downloads ficam prontos para leitura mesmo sem conexão.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offlineVolumes.map((volume) => (
              <div
                key={volume.volumeId}
                className="flex items-center gap-3 rounded-[1.1rem] border border-border/70 bg-background/55 p-3"
              >
                <Link
                  to="/ler/$volumeId"
                  params={{ volumeId: volume.volumeId }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-medium">{volume.mangaTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    Volume {volume.volumeNumber} · {volume.fileFormat === "epub" ? "Livro completo" : `${volume.pages.length} páginas`}
                  </p>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remover download"
                  onClick={() => void removeOfflineVolume(volume.volumeId)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function LibraryTab({
  value,
  icon,
  label,
  count,
  compact = false,
}: {
  value: string;
  icon: ReactNode;
  label: string;
  count?: number;
  compact?: boolean;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        compact
          ? "h-9 shrink-0 justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-xs text-muted-foreground shadow-none transition [&_svg]:size-3.5"
          : "h-auto justify-between rounded-[1rem] border border-transparent bg-background/35 px-3 py-3 text-left text-sm text-muted-foreground shadow-none transition [&_svg]:size-4",
        "data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground",
      )}
    >
      <span className="inline-flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </span>
      {count !== undefined ? (
        <span className={cn(
          "rounded-full bg-background/70 text-[10px] tabular-nums",
          compact ? "px-1.5 py-0" : "px-2 py-0.5",
        )}>
          {count}
        </span>
      ) : null}
    </TabsTrigger>
  );
}

function LibraryContent({
  value,
  mangas,
  loading,
  displayPreferences,
  favoriteIds,
  onToggleFavorite,
  title,
  description,
  emptyTitle,
  emptyText,
  action,
}: {
  value: string;
  mangas: MangaSummary[];
  loading: boolean;
  displayPreferences: CatalogDisplayPreferences;
  favoriteIds: Set<string>;
  onToggleFavorite: (mangaId: string) => void;
  title: string;
  description: string;
  emptyTitle: string;
  emptyText: string;
  action?: ReactNode;
}) {
  return (
    <TabsContent value={value} className="mt-0 space-y-4">
      <div className="flex items-end justify-between gap-3 border-b border-border/50 pb-2.5 sm:pb-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl">{title}</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">{description}</p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground sm:text-sm">{mangas.length} obra{mangas.length === 1 ? "" : "s"}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 justify-items-start gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <MangaCardSkeleton key={index} className="max-w-[220px]" />
          ))}
        </div>
      ) : mangas.length ? (
        <div className="grid grid-cols-2 justify-items-start gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {mangas.map((manga, index) => {
            const displayStyle = getCatalogDisplayStyle(displayPreferences, manga.work_type);
            return (
              <div key={manga.id} className="w-full max-w-[220px]">
                {displayStyle === "grid" ? (
                  <MangaCard
                    manga={manga}
                    favorite={favoriteIds.has(manga.id)}
                    onToggleFavorite={() => onToggleFavorite(manga.id)}
                    coverFit="contain"
                    showPersonalization
                  />
                ) : (
                  <CatalogDisplayCard
                    manga={manga}
                    style={displayStyle}
                    index={index}
                    favorite={favoriteIds.has(manga.id)}
                    onToggleFavorite={() => onToggleFavorite(manga.id)}
                    coverFit="contain"
                    showPersonalization
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[1.4rem] border border-border/70 bg-card/65 px-5 py-14 text-center shadow-[0_20px_50px_-32px_rgba(0,0,0,0.9)]">
          <Library className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 font-display text-xl">{emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{emptyText}</p>
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      )}
    </TabsContent>
  );
}
