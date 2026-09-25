import { personalPageCount, usePersonalLayouts } from "@/lib/readerPersonalization";
import { SynopsisPreview } from "@/components/SynopsisPreview";
import { getReaderPages } from "@/lib/readerPages";
import { useCatalogDisplayPreferences } from "@/hooks/useCatalogDisplayPreferences";
import { Route } from "@/routes/manga.$slug";
import { WORK_TYPES, unitLabel } from "@/lib/publication";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Download,
  DownloadCloud,
  ExternalLink,
  Heart,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Store,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PreferredMangaCard } from "@/components/PreferredMangaCard";
import { PublicationCover } from "@/components/PublicationCover";
import { RealisticBookModel } from "@/components/RealisticBookModel";
import { OpenBookPreview } from "@/components/OpenBookPreview";
import { CatalogPurchaseDialog } from "@/components/CatalogPurchaseDialog";
import { MangaCover, type MangaSummary } from "@/components/MangaCard";
import { CommentSection } from "@/components/CommentSection";
import { ReviewSection } from "@/components/ReviewSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, usePlus, useProfile } from "@/lib/auth";
import { formatMarketplacePrice } from "@/lib/marketplace";
import { getCatalogDisplayStyle } from "@/lib/catalogDisplay";
import {
  downloadEpubFile,
  downloadVolumeOffline,
  getOfflineVolumeIds,
  removeOfflineVolume,
} from "@/lib/offlineVolumes";

type VolumeRow = {
  id: string;
  number: number;
  page_count: number;
  unit_kind: "volume" | "chapter";
  file_format: "images" | "epub";
  published: boolean;
  cover_url: string | null;
};

const viewedMangaIds = new Set<string>();
const EMPTY_VOLUMES: VolumeRow[] = [];

export function MangaPage() {
  const { slug } = Route.useParams();
  const { invite } = Route.useSearch();
  const { user } = useAuth();
  const personalLayouts = usePersonalLayouts(user?.id);
  const displayPageCount = (volume: VolumeRow) => personalPageCount(volume, personalLayouts);
  const { data: isAdmin } = useIsAdmin();
  const { data: isPlus = false } = usePlus();
  const { data: profile } = useProfile();
  const catalogDisplayPreferences = useCatalogDisplayPreferences();
  const queryClient = useQueryClient();
  const [offlineVolumeIds, setOfflineVolumeIds] = useState<string[]>([]);
  const [offlineProgress, setOfflineProgress] = useState<{ volumeId: string | null; completed: number; total: number; label?: string } | null>(null);
  const [localProgress, setLocalProgress] = useState<
    Record<string, { page_index: number; completed_at: string | null }>
  >({});
  const [unitFilter, setUnitFilter] = useState("all");
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const { data: manga, isLoading, error: mangaError, refetch: refetchManga } = useQuery({
    queryKey: ["manga", slug, invite, user?.id],
    enabled: !invite || !!user,
    retry: false,
    queryFn: async () => {
      if (invite && user) {
        const { error: inviteError } = await supabase.rpc("redeem_manga_invite", {
          _token: invite,
        });
        if (inviteError) throw new Error("Este convite é inválido ou não está mais disponível.");
      }
      const { data, error } = await supabase
        .from("mangas")
        .select(
          "id, slug, title, author, synopsis, category, cover_url, genres, price_cents, currency, status, creator_id, visibility, work_type, is_collection, distribution_channel, catalog_sale_enabled",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Private metadata must not block the public details query. The RPC also
  // verifies ownership/admin permission before returning these fields.
  const { data: privateWorkFields } = useQuery({
    queryKey: ["work-private-fields", manga?.id, user?.id, isAdmin],
    enabled: !!manga && !!user && (manga.creator_id === user.id || !!isAdmin),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("booksyde_private_work_fields", {
        p_work_ids: [manga!.id],
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const { data: hasReadAccess = false, isLoading: isAccessLoading } = useQuery({
    queryKey: ["manga-read-access", user?.id, manga?.id, isAdmin],
    enabled: !!manga,
    queryFn: async () => {
      if (!manga) return false;

      const isFreePublicCatalog =
        manga.distribution_channel === "catalog" && Number(manga.price_cents) === 0;
      if (isFreePublicCatalog) return true;
      if (!user) return false;
      if (manga.creator_id === user.id || isAdmin) return true;

      const { data, error } = await supabase
        .from("manga_access")
        .select("manga_id")
        .eq("user_id", user.id)
        .eq("manga_id", manga.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const { data: volumes = EMPTY_VOLUMES } = useQuery({
    queryKey: ["volumes", manga?.id],
    enabled: !!manga,
    queryFn: async () => {
      const withCovers = await supabase
        .from("volumes")
        .select("id, number, unit_kind, file_format, page_count, published, cover_url")
        .eq("manga_id", manga!.id)
        .eq("published", true)
        .order("number");
      if (!withCovers.error) return (withCovers.data ?? []) as VolumeRow[];

      if (!withCovers.error.message.includes("cover_url")) throw withCovers.error;
      const fallback = await supabase
        .from("volumes")
        .select("id, number, unit_kind, file_format, page_count, published")
        .eq("manga_id", manga!.id)
        .eq("published", true)
        .order("number");
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((volume) => ({
        ...volume,
        unit_kind: volume.unit_kind === "chapter" ? "chapter" : "volume",
        file_format: volume.file_format === "epub" ? "epub" : "images",
        cover_url: null,
      })) satisfies VolumeRow[];
    },
  });

  const { data: similarBooks = [] } = useQuery({
    queryKey: ["similar-books", manga?.id, manga?.category, manga?.genres],
    enabled: !!manga && manga.work_type === "book" && !manga.is_collection,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mangas")
        .select(
          "id, slug, title, author, cover_url, genres, price_cents, currency, view_count, work_type, synopsis, category",
        )
        .eq("work_type", "book")
        .eq("visibility", "public")
        .eq("distribution_channel", "catalog")
        .neq("id", manga!.id)
        .limit(24);

      if (error) throw error;

      const sourceGenres = new Set((manga!.genres ?? []).map((genre) => genre.toLocaleLowerCase()));
      const sourceCategory = manga!.category?.trim().toLocaleLowerCase();

      return (data ?? [])
        .map((book) => {
          const sharedGenres = (book.genres ?? []).filter((genre) =>
            sourceGenres.has(genre.toLocaleLowerCase()),
          ).length;
          const sameCategory =
            !!sourceCategory && book.category?.trim().toLocaleLowerCase() === sourceCategory;
          return {
            book: book as MangaSummary,
            score: sharedGenres * 3 + (sameCategory ? 5 : 0),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ book }) => book);
    },
  });

  const { data: isFavorite = false } = useQuery({
    queryKey: ["manga-favorite", user?.id, manga?.id],
    enabled: !!user && !!manga,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manga_favorites")
        .select("manga_id")
        .eq("user_id", user!.id)
        .eq("manga_id", manga!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !manga) throw new Error("Entre na sua conta para favoritar mangás.");
      const result = isFavorite
        ? await supabase
            .from("manga_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("manga_id", manga.id)
        : await supabase.from("manga_favorites").insert({
            user_id: user.id,
            manga_id: manga.id,
          });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["manga-favorite", user?.id, manga?.id] });
      void queryClient.invalidateQueries({ queryKey: ["manga-favorites", user?.id] });
      toast.success(isFavorite ? "Removido dos favoritos" : "Adicionado aos favoritos");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!manga || viewedMangaIds.has(manga.id)) return;
    const storageKey = `mangaka-viewed-${manga.id}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // O conjunto em memória ainda evita contagens repetidas nesta execução.
    }
    viewedMangaIds.add(manga.id);
    void supabase.rpc("increment_manga_view", { _manga_id: manga.id });
  }, [manga]);

  const { data: firstPages = [] } = useQuery({
    queryKey: ["volume-first-pages", volumes.map((volume) => volume.id)],
    enabled: hasReadAccess && volumes.length > 0,
    queryFn: async () => {
      return getReaderPages(volumes.map((volume) => volume.id), 0);
    },
  });

  const { data: readingProgress = [] } = useQuery({
    queryKey: ["manga-reading-progress", user?.id, manga?.id, volumes.map((v) => v.id)],
    enabled: !!user && hasReadAccess && volumes.length > 0,
    queryFn: async () => {
      const withCompletion = await supabase
        .from("reading_progress")
        .select("volume_id, page_index, completed_at")
        .eq("user_id", user!.id)
        .in(
          "volume_id",
          volumes.map((volume) => volume.id),
        );
      if (!withCompletion.error) return withCompletion.data ?? [];
      if (!withCompletion.error.message.includes("completed_at")) throw withCompletion.error;
      const fallback = await supabase
        .from("reading_progress")
        .select("volume_id, page_index")
        .eq("user_id", user!.id)
        .in(
          "volume_id",
          volumes.map((volume) => volume.id),
        );
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((progress) => ({ ...progress, completed_at: null }));
    },
  });

  // A conclusão manual pertence às informações da obra, não aos controles do leitor.
  const markReadMutation = useMutation({
    mutationFn: async (volume: VolumeRow) => {
      if (!user || !hasReadAccess) throw new Error("Entre na sua conta para registrar a leitura.");
      if (!navigator.onLine) throw new Error("Conecte-se à internet para marcar este livro como lido.");
      const completedAt = new Date().toISOString();
      const saved = readingProgress.find((progress) => progress.volume_id === volume.id) ?? localProgress[volume.id];
      const pageIndex = Math.max(0, saved?.page_index ?? 0);
      const { error } = await supabase.from("reading_progress").upsert(
        {
          user_id: user.id,
          volume_id: volume.id,
          page_index: pageIndex,
          completed_at: completedAt,
          updated_at: completedAt,
        },
        { onConflict: "user_id,volume_id" },
      );
      if (error) throw error;
      return { volumeId: volume.id, page_index: pageIndex, completed_at: completedAt };
    },
    onSuccess: (result) => {
      window.localStorage.setItem(`mangaka-page-${result.volumeId}`, String(result.page_index));
      window.localStorage.setItem(`mangaka-completed-${result.volumeId}`, result.completed_at);
      setLocalProgress((previous) => ({
        ...previous,
        [result.volumeId]: { page_index: result.page_index, completed_at: result.completed_at },
      }));
      void queryClient.invalidateQueries({ queryKey: ["manga-reading-progress", user?.id, manga?.id] });
      void queryClient.invalidateQueries({ queryKey: ["personal-library", user?.id] });
      toast.success("Livro marcado como lido.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível registrar a conclusão."),
  });

  useEffect(() => {
    const saved = Object.fromEntries(
      volumes.flatMap((volume) => {
        const value = window.localStorage.getItem(`mangaka-page-${volume.id}`);
        if (value === null) return [];
        const pageIndex = Number(value);
        if (!Number.isInteger(pageIndex) || pageIndex < 0) return [];
        return [
          [
            volume.id,
            {
              page_index: pageIndex,
              completed_at:
                volume.file_format === "epub"
                  ? window.localStorage.getItem(`mangaka-completed-${volume.id}`)
                  : pageIndex + 1 >= volume.page_count
                    ? "local"
                    : null,
            },
          ],
        ];
      }),
    );
    setLocalProgress(saved);
  }, [volumes]);

  useEffect(() => {
    setOfflineVolumeIds(getOfflineVolumeIds());
  }, []);

  async function toggleOfflineVolume(volume: VolumeRow) {
    if (!manga) return;
    if (offlineVolumeIds.includes(volume.id)) {
      await removeOfflineVolume(volume.id);
      setOfflineVolumeIds(getOfflineVolumeIds());
      toast.success("Download removido");
      return;
    }
    const isEpub = volume.file_format === "epub";
    try {
      setOfflineProgress({
        volumeId: volume.id,
        completed: 0,
        total: isEpub ? 1 : volume.page_count,
      });
      await downloadVolumeOffline({
        volumeId: volume.id,
        volumeNumber: volume.number,
        mangaId: manga.id,
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        workType: manga.work_type as "manga" | "hq" | "gibi" | "book",
        fileFormat: isEpub ? "epub" : "images",
        onProgress: (completed, total) =>
          setOfflineProgress({ volumeId: volume.id, completed, total }),
      });
      setOfflineVolumeIds(getOfflineVolumeIds());
      toast.success(`${unitLabel(volume.unit_kind)}: ${volume.number} disponível offline`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o volume");
    } finally {
      setOfflineProgress(null);
    }
  }

  async function downloadWholeWork() {
    if (!manga || !hasReadAccess) return;
    const ordered = [...volumes].sort((a,b) => a.number - b.number);
    const missing = ordered.filter((v) => !offlineVolumeIds.includes(v.id));
    if (!missing.length) { toast.success("Obra completa já está disponível offline"); return; }
    const grandTotal = missing.reduce((sum,v) => sum + (v.file_format === "epub" ? 1 : Math.max(1,v.page_count)), 0);
    let finished = 0;
    try {
      setOfflineProgress({ volumeId: null, completed: 0, total: grandTotal, label: "Baixando obra completa" });
      for (const volume of missing) {
        const units = volume.file_format === "epub" ? 1 : Math.max(1, volume.page_count);
        await downloadVolumeOffline({ volumeId: volume.id, volumeNumber: volume.number, mangaId: manga.id, mangaSlug: manga.slug, mangaTitle: manga.title, workType: manga.work_type as "manga"|"hq"|"gibi"|"book", fileFormat: volume.file_format === "epub" ? "epub" : "images", onProgress: (completed) => setOfflineProgress({ volumeId: null, completed: Math.min(grandTotal, finished + completed), total: grandTotal, label: "Baixando obra completa" }) });
        finished += units; setOfflineVolumeIds(getOfflineVolumeIds());
      }
      toast.success("Obra completa disponível offline");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível baixar a obra completa"); } finally { setOfflineProgress(null); }
  }

  async function downloadBookFile(volume: VolumeRow) {
    if (!manga || volume.file_format !== "epub") return;

    try {
      toast.info("Preparando o arquivo completo…");
      await downloadEpubFile({
        volumeId: volume.id,
        fileName: `${manga.title} - ${unitLabel(volume.unit_kind)} ${volume.number}.epub`,
      });
      toast.success("Livro baixado com sucesso");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o livro");
    }
  }

  if (invite && !user) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Você recebeu um convite</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Entre na sua conta e abra este link novamente para acessar a obra.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </main>
    );
  }

  if (isLoading) {
    return <main className="mx-auto max-w-6xl px-4 py-12 text-muted-foreground">Carregando…</main>;
  }

  if (mangaError) {
    return <main className="mx-auto max-w-2xl px-4 py-12" role="alert">
      <h1 className="font-display text-2xl">Não foi possível carregar os detalhes</h1>
      <p className="mt-3 text-sm text-muted-foreground">{mangaError.message}</p>
      <Button className="mt-6" onClick={() => void refetchManga()}>Tentar novamente</Button>
    </main>;
  }

  if (!manga) {
    return <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-2xl">Obra indisponível</h1>
      <p className="mt-3 text-sm text-muted-foreground">Esta obra não foi encontrada ou sua conta não tem acesso a ela.</p>
      <Button className="mt-6" asChild><Link to="/">Voltar ao início</Link></Button>
    </main>;
  }

  const progressByVolume = new Map(
    volumes.map((volume) => {
      const remote = readingProgress.find((progress) => progress.volume_id === volume.id);
      const personal = volume.file_format === "epub" ? personalLayouts[volume.id] : undefined;
      const local = personal ? { page_index: personal.pageIndex, completed_at: null } : localProgress[volume.id];
      return [volume.id, remote || local ? {
        page_index: personal?.pageIndex ?? remote?.page_index ?? local?.page_index ?? 0,
        completed_at: remote?.completed_at ?? local?.completed_at ?? null,
      } : undefined] as const;
    }),
  );

  const isVolumeCompleted = (volume: VolumeRow) => {
    const progress = progressByVolume.get(volume.id);
    return (
      !!progress?.completed_at ||
      (volume.file_format !== "epub" && (progress?.page_index ?? -1) + 1 >= volume.page_count)
    );
  };

  const volumePercent = (volume: VolumeRow) => {
    const progress = progressByVolume.get(volume.id);
    if (!progress) return 0;
    if (isVolumeCompleted(volume)) return 100;
    if (!displayPageCount(volume)) return 0;
    return Math.max(0, Math.min(100, Math.round((((progress.page_index ?? -1) + 1) / displayPageCount(volume)) * 100)));
  };

  const orderedVolumes = volumes
    .filter((volume) => unitFilter === "all" || volume.unit_kind === unitFilter)
    .sort((a, b) => {
      const aCompleted = isVolumeCompleted(a);
      const bCompleted = isVolumeCompleted(b);
      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
      return a.number - b.number;
    });

  const continueVolume =
    orderedVolumes.find((volume) => {
      const progress = progressByVolume.get(volume.id);
      return progress && !isVolumeCompleted(volume);
    }) ?? orderedVolumes[0] ?? null;
  const collectionVolumes = [...volumes].sort((a, b) => a.number - b.number);

  const totalPages = volumes.reduce((sum, volume) => sum + (displayPageCount(volume) ?? 0), 0);
  const completedVolumes = volumes.filter((volume) => isVolumeCompleted(volume)).length;
  const workTypeLabel = WORK_TYPES.find((type) => type.value === manga.work_type)?.label ?? "Mangá";
  const shareContentLabel =
    manga.work_type === "book"
      ? "livro"
      : manga.work_type === "hq"
        ? "HQ"
        : manga.work_type === "gibi"
          ? "gibi"
          : "mangá";
  const isPublicCatalogItem = manga.distribution_channel === "catalog";
  // No Catálogo, o preço é a fonte de verdade:
  // R$ 0,00 = leitura gratuita; a partir de R$ 1,00 = compra direta.
  const isDirectCatalogSale = isPublicCatalogItem && Number(manga.price_cents) >= 100;
  const officialPurchaseSearch = `https://www.google.com/search?q=${encodeURIComponent(
    `${manga.title} ${manga.author || ""} comprar oficial editora loja autorizada`,
  )}`;
  const purchaseHref = privateWorkFields?.licensed_purchase_url?.trim() || officialPurchaseSearch;
  const purchaseLabel = privateWorkFields?.licensed_purchase_url
    ? `Comprar em ${privateWorkFields?.licensed_store_name?.trim() || "fonte licenciada"}`
    : "Buscar onde comprar oficialmente";
  const realisticDisplay = getCatalogDisplayStyle(catalogDisplayPreferences, manga.work_type) === "realistic";
  const isBook = manga.work_type === "book";
  const isBookCollection = isBook && manga.is_collection;
  const continuePercent = continueVolume ? volumePercent(continueVolume) : 0;
  const singleBookVolume = isBook && !isBookCollection ? collectionVolumes[0] : null;

  function readStatusAction(volume: VolumeRow, className = "") {
    if (!user || !hasReadAccess) return null;
    if (isVolumeCompleted(volume)) {
      return (
        <span className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-4 text-xs font-semibold text-emerald-400 ${className}`}>
          <CheckCircle2 className="size-4" /> {isBook ? "Livro lido" : "Concluído"}
        </span>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`min-h-10 rounded-full ${className}`}
        disabled={markReadMutation.isPending}
        onClick={() => markReadMutation.mutate(volume)}
        title={`Marcar ${unitLabel(volume.unit_kind).toLowerCase()} ${volume.number} como lido`}
      >
        <CheckCircle2 className="size-4" />
        {markReadMutation.isPending && markReadMutation.variables?.id === volume.id ? "Salvando…" : "Marcar como lido"}
      </Button>
    );
  }

  return (
    <main className="w-full px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-24 sm:pt-7 lg:px-6 lg:pt-8 2xl:px-8">
      {isBook ? (
        <>
          {/* Mobile / tablet: capa em destaque com informações sobre o gradient. */}
          <section className="relative mx-auto h-[clamp(560px,calc(100dvh-9rem),820px)] min-h-[560px] w-full max-w-[560px] overflow-hidden rounded-[clamp(1.4rem,5vw,2rem)] border border-white/10 bg-card shadow-[0_34px_90px_-38px_rgba(0,0,0,.95)] sm:min-h-[620px] lg:hidden">
            {realisticDisplay ? (
              <>
                <div className="absolute inset-0 scale-110 opacity-30 blur-2xl [&_.book-cover]:h-full [&_.book-cover]:aspect-auto [&_.book-cover]:rounded-none">
                  <MangaCover coverUrl={manga.cover_url} title={manga.title} />
                </div>
                <div className="absolute inset-x-[8%] top-[6%] h-[46%]">
                  <RealisticBookModel coverUrl={manga.cover_url} title={manga.title} />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,.08),transparent_34%),linear-gradient(to_top,rgba(0,0,0,.97)_0%,rgba(0,0,0,.78)_38%,rgba(0,0,0,.25)_72%,rgba(0,0,0,.12)_100%)]" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 [&_.book-cover]:h-full [&_.book-cover]:aspect-auto [&_.book-cover]:rounded-none">
                  <MangaCover coverUrl={manga.cover_url} title={manga.title} />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent [background:linear-gradient(to_top,rgba(0,0,0,.96)_0%,rgba(0,0,0,.74)_34%,rgba(0,0,0,.18)_68%,rgba(0,0,0,.08)_100%)]" />
              </>
            )}

            <button
              type="button"
              aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              disabled={favoriteMutation.isPending}
              onClick={() => {
                if (!user) {
                  toast.info("Entre na sua conta para favoritar livros.");
                  return;
                }
                favoriteMutation.mutate();
              }}
              className="absolute right-4 top-4 z-20 grid size-12 place-items-center rounded-full border border-white/20 bg-black/45 text-white shadow-xl backdrop-blur-xl transition hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              <Heart className={`size-5 ${isFavorite ? "fill-primary text-primary" : ""}`} />
            </button>

            <div className="absolute inset-x-0 bottom-0 z-10 space-y-4 p-5 pb-[max(1.35rem,env(safe-area-inset-bottom))] sm:p-7">
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full border border-white/15 bg-black/35 text-white shadow-none backdrop-blur">
                  {isBookCollection ? "Coleção" : "Livro"}
                </Badge>
                {isBookCollection ? (
                  <Badge className="rounded-full border border-white/15 bg-black/35 text-white shadow-none backdrop-blur">
                    {volumes.length} {volumes.length === 1 ? "livro" : "livros"}
                  </Badge>
                ) : null}
              </div>

              <div>
                <h1 className="font-display text-4xl leading-[1.02] text-white sm:text-5xl">
                  {manga.title}
                </h1>
                <p className="mt-2 text-sm text-white/72 sm:text-base">
                  {manga.author || "Autor desconhecido"}
                </p>
              </div>

              {(manga.genres ?? []).length ? (
                <div className="flex flex-wrap gap-2">
                  {(manga.genres ?? []).slice(0, 4).map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs text-white/85 backdrop-blur"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              ) : null}

              {manga.synopsis ? (
                <SynopsisPreview text={manga.synopsis} title={manga.title} className="text-sm leading-relaxed text-white/72" />
              ) : null}

              {hasReadAccess ? (
                <div className="grid gap-2">
                  {continueVolume ? (
                    <Button size="lg" className="min-h-12 w-full rounded-full" asChild>
                      <Link to="/ler/$volumeId" params={{ volumeId: continueVolume.id }}>
                        <BookOpen className="size-4" />
                        {continuePercent > 0 ? "Continuar leitura" : "Começar leitura"}
                      </Link>
                    </Button>
                  ) : null}
                  {singleBookVolume ? readStatusAction(singleBookVolume, "w-full border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white") : null}
                  {isBookCollection ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="min-h-12 w-full rounded-full border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/15 hover:text-white"
                      asChild
                    >
                      <a href="#collection-books">Ver livros da coleção</a>
                    </Button>
                  ) : null}
                </div>
              ) : isPublicCatalogItem && !isAccessLoading ? (
                <div className="grid gap-2">
                  {isDirectCatalogSale ? (
                    <Button
                      type="button"
                      size="lg"
                      className="min-h-12 w-full rounded-full"
                      onClick={() => {
                        if (!user) {
                          void window.location.assign("/auth");
                          return;
                        }
                        setPurchaseOpen(true);
                      }}
                    >
                      <ShoppingBag className="size-4" />
                      Comprar por {formatMarketplacePrice(manga.price_cents, manga.currency)}
                    </Button>
                  ) : (
                    <Button size="lg" className="min-h-12 w-full rounded-full" asChild>
                      <a href={purchaseHref} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" /> {purchaseLabel}
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-h-12 w-full rounded-full border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/15 hover:text-white"
                    asChild
                  >
                    <Link to="/marketplace" search={{ seller: "", connect: "", similarTo: manga.id }}>
                      <Store className="size-4" /> Procurar parecidos no Marketplace
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          {/* Desktop Realista: composição editorial, informações à esquerda e livro físico aberto à direita. */}
          {realisticDisplay ? (
            <section className="relative hidden min-h-[clamp(560px,calc(100dvh-180px),780px)] overflow-hidden rounded-[2rem] border border-border/50 bg-card/35 lg:flex lg:items-center">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(255,255,255,.08),transparent_31%),radial-gradient(circle_at_18%_30%,rgba(255,255,255,.035),transparent_25%)]" />

              <div className="relative z-10 grid w-full grid-cols-[minmax(0,42fr)_minmax(0,58fr)] items-center gap-[clamp(1.5rem,3vw,4rem)] px-[clamp(2rem,3vw,4rem)] py-[clamp(3rem,7vh,6rem)]">
                <article className="relative z-20 min-w-0 max-w-[590px] overflow-hidden">
                  <div className="mb-5 flex flex-wrap gap-2">
                    <Badge className="rounded-full border border-border/70 bg-background/55 px-3 py-1 shadow-none backdrop-blur">
                      {isBookCollection ? "Coleção" : "Livro"}
                    </Badge>
                    {manga.status ? (
                      <Badge variant="outline" className="rounded-full border-border/70 bg-background/40 px-3 py-1 capitalize backdrop-blur">
                        {String(manga.status).replace(/_/g, " ")}
                      </Badge>
                    ) : null}
                  </div>

                  <h1 className="font-display text-[clamp(3rem,4vw,5.2rem)] leading-[.92] tracking-[-.045em] text-foreground">
                    {manga.title}
                  </h1>
                  <p className="mt-5 text-base font-medium text-muted-foreground">
                    {manga.author || "Autor desconhecido"}
                  </p>

                  {manga.synopsis ? (
                    <SynopsisPreview text={manga.synopsis} title={manga.title} className="mt-5 max-w-[520px] text-sm leading-relaxed text-muted-foreground" />
                  ) : null}

                  {(manga.genres ?? []).length ? (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {(manga.genres ?? []).slice(0, 5).map((genre) => (
                        <span key={genre} className="rounded-full border border-border/60 bg-background/35 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">{genre}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    {hasReadAccess && continueVolume ? (
                      <Button size="lg" className="min-h-12 rounded-full px-7" asChild>
                        <Link to="/ler/$volumeId" params={{ volumeId: continueVolume.id }}>
                          <BookOpen className="size-4" />
                          {continuePercent > 0 ? "Continuar leitura" : "Começar leitura"}
                        </Link>
                      </Button>
                    ) : isPublicCatalogItem && !isAccessLoading && isDirectCatalogSale ? (
                      <Button type="button" size="lg" className="min-h-12 rounded-full px-7" onClick={() => { if (!user) { void window.location.assign("/auth"); return; } setPurchaseOpen(true); }}>
                        <ShoppingBag className="size-4" /> Comprar por {formatMarketplacePrice(manga.price_cents, manga.currency)}
                      </Button>
                    ) : isPublicCatalogItem && !isAccessLoading ? (
                      <Button size="lg" className="min-h-12 rounded-full px-7" asChild>
                        <a href={purchaseHref} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> {purchaseLabel}</a>
                      </Button>
                    ) : null}

                    {singleBookVolume ? readStatusAction(singleBookVolume, "min-h-12 rounded-full px-5") : null}
                    {hasReadAccess && singleBookVolume?.file_format === "epub" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="min-h-12 rounded-full px-6"
                        disabled={offlineProgress?.volumeId === singleBookVolume.id}
                        onClick={() => void downloadBookFile(singleBookVolume)}
                      >
                        <Download className="size-4" /> Baixar livro
                      </Button>
                    ) : null}
                    {hasReadAccess && singleBookVolume ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="min-h-12 rounded-full px-6"
                        disabled={!!offlineProgress}
                        onClick={() => void toggleOfflineVolume(singleBookVolume)}
                      >
                        {offlineVolumeIds.includes(singleBookVolume.id) ? <Trash2 className="size-4" /> : <DownloadCloud className="size-4" />}
                        {offlineVolumeIds.includes(singleBookVolume.id) ? "Remover offline" : "Baixar offline"}
                      </Button>
                    ) : null}
                    {isBookCollection ? (
                      <Button variant="outline" size="lg" className="min-h-12 rounded-full px-6" asChild><a href="#collection-books">Ver coleção</a></Button>
                    ) : null}
                  </div>
                </article>

                <div className="relative z-10 flex min-w-0 items-center justify-end">
                  <div className="relative w-full max-w-[820px]">
                    <OpenBookPreview
                      coverUrl={manga.cover_url}
                      title={manga.title}
                      synopsis={manga.synopsis}
                      volume={collectionVolumes[0]}
                      mangaId={manga.id}
                      hasReadAccess={hasReadAccess}
                      canPublishPreview={manga.visibility === "public" && (manga.distribution_channel === "catalog" || manga.distribution_channel === "marketplace") && !!user && (manga.creator_id === user.id || !!isAdmin)}
                    />
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* Desktop padrão: livro aberto, dados na página esquerda e capa na página direita. */}
          <section className={realisticDisplay ? "hidden" : "relative hidden lg:block"}>
            <div className="relative mx-auto max-w-[calc(100vw-3rem)] [perspective:1800px] 2xl:max-w-[1480px]">
              <div className="relative grid h-[clamp(520px,calc(100dvh-190px),720px)] min-h-0 grid-cols-2 overflow-hidden rounded-[clamp(1.8rem,2.6vw,2.6rem)] border border-[#b9ad99]/80 bg-[#ebe4d6] text-[#25221c] shadow-[0_42px_110px_-36px_rgba(0,0,0,.96),0_5px_20px_-10px_rgba(0,0,0,.7)]">
                <div className="absolute inset-y-0 left-1/2 z-20 w-14 -translate-x-1/2 bg-[linear-gradient(90deg,rgba(46,37,28,.12),rgba(255,255,255,.32)_46%,rgba(64,50,36,.16)_54%,rgba(255,255,255,.18))] shadow-[inset_10px_0_20px_-18px_rgba(0,0,0,.9),inset_-10px_0_20px_-18px_rgba(0,0,0,.9)]" />
                <div className="pointer-events-none absolute inset-x-8 bottom-2 z-0 h-10 rounded-[50%] bg-black/45 blur-2xl" />

                <article className="relative z-10 flex min-w-0 flex-col justify-center overflow-hidden bg-[radial-gradient(circle_at_100%_50%,rgba(80,64,45,.08),transparent_38%),linear-gradient(105deg,#f4efe5_0%,#eee7da_68%,#e2d8c7_100%)] px-[clamp(2rem,3.4vw,4rem)] py-[clamp(1.65rem,3.8vh,3.25rem)]">
                  <div className="pointer-events-none absolute inset-y-7 left-5 w-px bg-black/6" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/55 to-transparent" />

                  <div className="relative max-h-full max-w-[min(100%,560px)] overflow-y-auto">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-black/10 bg-white/45 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-black/60 uppercase">
                        {isBookCollection ? "Coleção" : "Livro"}
                      </span>
                      {isBookCollection ? (
                        <span className="rounded-full border border-black/10 bg-white/45 px-3 py-1 text-xs text-black/55">
                          {volumes.length} {volumes.length === 1 ? "livro" : "livros"}
                        </span>
                      ) : null}
                      {manga.status ? (
                        <span className="rounded-full border border-black/10 bg-white/45 px-3 py-1 text-xs capitalize text-black/55">
                          {String(manga.status).replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </div>

                    <h1 title={manga.title} className="mt-4 line-clamp-2 break-words font-display text-[clamp(2rem,3vw,3.5rem)] leading-[1.05] tracking-[-.04em] text-[#201d18]">
                      {manga.title}
                    </h1>
                    <p className="mt-[clamp(.6rem,1.6vh,1rem)] text-[clamp(.875rem,1.15vw,1rem)] font-medium text-black/55">
                      {manga.author || "Autor desconhecido"}
                    </p>

                    {manga.synopsis ? (
                      <SynopsisPreview text={manga.synopsis} title={manga.title} className="mt-4 max-w-[46rem] text-sm leading-relaxed text-black/64" />
                    ) : null}

                    {(manga.genres ?? []).length ? (
                      <div className="mt-[clamp(1rem,2.5vh,1.75rem)] flex flex-wrap gap-2">
                        {(manga.genres ?? []).slice(0, 6).map((genre) => (
                          <span
                            key={genre}
                            className="rounded-full border border-black/10 bg-white/45 px-3 py-1.5 text-xs font-medium text-black/60"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {hasReadAccess ? (
                      <div className="mt-[clamp(1.1rem,2.8vh,2rem)] flex flex-wrap items-center gap-3">
                        {continueVolume ? (
                          <Button size="lg" className="min-h-12 rounded-full px-6" asChild>
                            <Link to="/ler/$volumeId" params={{ volumeId: continueVolume.id }}>
                              <BookOpen className="size-4" />
                              {continuePercent > 0 ? "Continuar leitura" : "Começar leitura"}
                            </Link>
                          </Button>
                        ) : null}
                        {singleBookVolume ? readStatusAction(singleBookVolume, "min-h-12 border-black/15 bg-white/45 px-5 text-[#25221c] hover:bg-white/75 hover:text-[#25221c]") : null}
                        {isBookCollection ? (
                          <Button
                            variant="outline"
                            size="lg"
                            className="min-h-12 rounded-full border-black/15 bg-white/45 px-6 text-[#25221c] hover:bg-white/75 hover:text-[#25221c]"
                            asChild
                          >
                            <a href="#collection-books">Ver livros da coleção</a>
                          </Button>
                        ) : null}
                      </div>
                    ) : isPublicCatalogItem && !isAccessLoading ? (
                      <div className="mt-[clamp(1.1rem,2.8vh,2rem)] space-y-3">
                        <div className="flex flex-wrap gap-3">
                          {isDirectCatalogSale ? (
                            <Button
                              type="button"
                              size="lg"
                              className="min-h-12 rounded-full px-6"
                              onClick={() => {
                                if (!user) {
                                  void window.location.assign("/auth");
                                  return;
                                }
                                setPurchaseOpen(true);
                              }}
                            >
                              <ShoppingBag className="size-4" />
                              Comprar por {formatMarketplacePrice(manga.price_cents, manga.currency)}
                            </Button>
                          ) : (
                            <Button size="lg" className="min-h-12 rounded-full px-6" asChild>
                              <a href={purchaseHref} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-4" /> {purchaseLabel}
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="lg"
                            className="min-h-12 rounded-full border-black/15 bg-white/45 px-6 text-[#25221c] hover:bg-white/75 hover:text-[#25221c]"
                            asChild
                          >
                            <Link
                              to="/marketplace"
                              search={{ seller: "", connect: "", similarTo: manga.id }}
                            >
                              <Store className="size-4" /> Procurar parecidos
                            </Link>
                          </Button>
                        </div>
                        {!isDirectCatalogSale && !privateWorkFields?.licensed_purchase_url ? (
                          <p className="flex max-w-[38rem] items-start gap-2 text-xs leading-relaxed text-black/48">
                            <Search className="mt-0.5 size-3.5 shrink-0" />
                            Ainda não há uma loja licenciada cadastrada; a busca abre resultados externos para encontrar uma edição oficial.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>

                <article className="relative z-10 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_50%,rgba(73,57,39,.08),transparent_42%),linear-gradient(75deg,#e2d8c7_0%,#eee7da_34%,#f5f0e7_100%)] px-[clamp(2rem,3.4vw,4rem)] py-[clamp(1.65rem,3.8vh,3.25rem)]">
                  <div className="pointer-events-none absolute inset-y-7 right-5 w-px bg-black/6" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/55 to-transparent" />

                  <button
                    type="button"
                    aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    disabled={favoriteMutation.isPending}
                    onClick={() => {
                      if (!user) {
                        toast.info("Entre na sua conta para favoritar livros.");
                        return;
                      }
                      favoriteMutation.mutate();
                    }}
                    className="absolute right-[clamp(1.25rem,2.4vw,2rem)] top-[clamp(1.25rem,2.4vw,2rem)] z-30 grid size-[clamp(2.75rem,3.4vw,3rem)] place-items-center rounded-full border border-black/10 bg-white/55 text-black/60 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  >
                    <Heart className={`size-5 ${isFavorite ? "fill-primary text-primary" : ""}`} />
                  </button>

                  <div className="relative w-[min(76%,380px)] max-w-[380px] [perspective:1200px]">
                    {realisticDisplay ? (
                      <div className="relative aspect-[7/8] w-full">
                        <RealisticBookModel coverUrl={manga.cover_url} title={manga.title} />
                      </div>
                    ) : (
                      <>
                        <div className="absolute -bottom-9 left-[8%] right-[2%] h-12 rounded-[50%] bg-black/28 blur-xl" />
                        <div className="relative -rotate-[1.6deg] overflow-hidden rounded-[.7rem] border border-black/15 bg-[#ded5c5] p-[5px] shadow-[18px_24px_45px_-22px_rgba(0,0,0,.75),-4px_8px_20px_-12px_rgba(0,0,0,.55)] transition duration-500 hover:rotate-0 hover:scale-[1.015]">
                          <MangaCover coverUrl={manga.cover_url} title={manga.title} />
                        </div>
                        <div className="pointer-events-none absolute -bottom-3 left-4 right-[-3px] h-3 rounded-b-md border border-black/10 bg-[repeating-linear-gradient(to_bottom,#f2eadc_0px,#f2eadc_1px,#d8cdbb_1px,#d8cdbb_2px)] shadow-sm" />
                      </>
                    )}
                  </div>

                  <div className="absolute bottom-[clamp(1.1rem,2.5vh,2rem)] left-1/2 -translate-x-1/2 whitespace-nowrap text-[clamp(.58rem,.75vw,.7rem)] font-medium tracking-[0.18em] text-black/35 uppercase">
                    {isBookCollection ? "Coleção BookSyde" : "Sua próxima leitura"}
                  </div>
                </article>
              </div>
            </div>
          </section>
        </>
      ) : (
      <section className="relative overflow-hidden rounded-[1.45rem] border border-border/70 bg-card/75 p-4 sm:rounded-[2rem] sm:p-7 lg:p-8 shadow-[0_30px_80px_-42px_rgba(0,0,0,0.92)] backdrop-blur sm:p-7 lg:p-8">
        <div className="absolute -left-14 top-4 size-52 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-72 rounded-full bg-white/5 blur-3xl" />
        <div className="relative grid gap-6 sm:gap-8 lg:grid-cols-[320px_1fr]">
          <div className="mx-auto w-full max-w-[280px] lg:max-w-none">
            <div className={realisticDisplay ? "relative aspect-[7/8] overflow-visible" : "overflow-hidden rounded-[1.8rem] border border-border/70 bg-background/60 p-3 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.96)]"}>
              {realisticDisplay ? (
                <RealisticBookModel coverUrl={manga.cover_url} title={manga.title} />
              ) : (
                <MangaCover coverUrl={manga.cover_url} title={manga.title} />
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary shadow-none">
                {workTypeLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/60 px-3 py-1">
                {volumes.length} {volumes.length === 1 ? "unidade" : "unidades"}
              </Badge>
              {manga.status ? (
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/60 px-3 py-1 capitalize">
                  {String(manga.status).replace(/_/g, " ")}
                </Badge>
              ) : null}
              {isPublicCatalogItem ? (
                <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/5 px-3 py-1 text-primary">
                  Catálogo público
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="min-w-0 break-words font-display text-[clamp(2rem,10vw,2.75rem)] leading-[1.05] sm:text-5xl">{manga.title}</h1>
                <p className="mt-2 text-base text-muted-foreground">{manga.author || "Autor desconhecido"}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isFavorite ? "default" : "outline"}
                  disabled={favoriteMutation.isPending}
                  onClick={() => {
                    if (!user) {
                      toast.info("Entre na sua conta para favoritar mangás.");
                      return;
                    }
                    favoriteMutation.mutate();
                  }}
                >
                  <Heart className={isFavorite ? "fill-current" : ""} />
                  <span className="hidden sm:inline">{isFavorite ? "Favoritado" : "Favoritar"}</span>
                </Button>
              </div>
            </div>

            {manga.genres.length ? (
              <div className="flex flex-wrap gap-2">
                {manga.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-border/70 bg-background/55 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}

            <SynopsisPreview text={manga.synopsis} title={manga.title} className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base" />

            {hasReadAccess ? (
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                <StatCard label="Volumes concluídos" value={`${completedVolumes}/${volumes.length || 0}`} />
                <StatCard label="Páginas disponíveis" value={String(totalPages)} />
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <StatCard label="Leitura" value={continueVolume ? "Pronta para continuar" : "Sem unidades"} />
                </div>
              </div>
            ) : null}

            {isPublicCatalogItem && !hasReadAccess && !isAccessLoading ? (
              <div className="rounded-[1.3rem] border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold">
                  {isDirectCatalogSale ? "Comprar esta obra" : "Encontre uma edição oficial"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {isDirectCatalogSale
                    ? "O pagamento é feito pelo BookSyde. Depois da confirmação, o vendedor envia os códigos de ativação no chat e você pode importar a obra para a Biblioteca."
                    : "Você ainda não possui esta obra na sua biblioteca. Encontre uma fonte licenciada de compra ou procure opções semelhantes publicadas por criadores no Marketplace."}
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {isDirectCatalogSale ? (
                    <Button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          void window.location.assign("/auth");
                          return;
                        }
                        setPurchaseOpen(true);
                      }}
                    >
                      <ShoppingBag className="size-4" />
                      Comprar por {formatMarketplacePrice(manga.price_cents, manga.currency)}
                    </Button>
                  ) : (
                    <Button asChild>
                      <a href={purchaseHref} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" /> {purchaseLabel}
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link
                      to="/marketplace"
                      search={{ seller: "", connect: "", similarTo: manga.id }}
                    >
                      <Store className="size-4" /> Procurar parecidos no Marketplace
                    </Link>
                  </Button>
                </div>
                {!isDirectCatalogSale && !privateWorkFields?.licensed_purchase_url ? (
                  <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                    <Search className="mt-0.5 size-3.5 shrink-0" />
                    Ainda não há uma loja licenciada cadastrada pelo Admin; por isso, o primeiro botão abre uma busca externa por uma fonte oficial.
                  </p>
                ) : null}
              </div>
            ) : null}

            {hasReadAccess ? (
              <div className="grid gap-2 min-[420px]:flex min-[420px]:flex-wrap min-[420px]:gap-3">
                {continueVolume ? (
                  <Button asChild>
                    <Link to="/ler/$volumeId" params={{ volumeId: continueVolume.id }}>
                      <BookOpen className="size-4" />
                      {volumePercent(continueVolume) > 0 ? "Continuar lendo" : "Começar leitura"}
                    </Link>
                  </Button>
                ) : null}
                <Button variant="outline" asChild>
                  <a href="#volumes">
                    <Share2 className="size-4" /> Ver volumes
                  </a>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      )}

      {isBook ? (
        isBookCollection ? (
          <section id="collection-books" className="mt-8 space-y-5 sm:mt-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Coleção</p>
                <h2 className="font-display text-3xl">Livros da coleção</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Todos os livros publicados dentro de {manga.title}, organizados na ordem de leitura.
                </p>
              </div>
              {isAdmin || manga.creator_id === user?.id ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/studio" search={{ obra: manga.id, aba: "volumes" }}>
                    <Plus className="size-4" /> Adicionar livro
                  </Link>
                </Button>
              ) : null}
            </div>

            {collectionVolumes.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {collectionVolumes.map((volume) => {
                  const completed = isVolumeCompleted(volume);
                  const percent = volumePercent(volume);
                  const previewPage = firstPages.find(
                    (page) => page.volume_id === volume.id,
                  )?.storage_path;

                  return (
                    <article
                      key={volume.id}
                      className="group min-w-0 overflow-hidden rounded-[1.55rem] border border-border/70 bg-card/70 p-2.5 shadow-[0_20px_55px_-32px_rgba(0,0,0,.95)]"
                    >
                      <div className="relative overflow-hidden rounded-[1.15rem] border border-border/60 bg-background">
                        <PublicationCover
                          workType={manga.work_type}
                          coverUrl={volume.cover_url}
                          title={`${manga.title} · Livro ${volume.number}`}
                          fallbackPagePath={previewPage}
                          fallbackCoverUrl={manga.cover_url}
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                          <p className="text-[10px] font-semibold tracking-[0.16em] text-white/65 uppercase">
                            Livro {volume.number}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold">
                            {manga.title}
                          </p>
                        </div>
                        {completed ? (
                          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                            Concluído
                          </span>
                        ) : percent > 0 ? (
                          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                            {percent}% lido
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-3 px-1 pb-1 pt-3">
                        <p className="text-xs text-muted-foreground">
                          {displayPageCount(volume)} páginas
                        </p>
                        {hasReadAccess ? (
                          <div className="flex items-center gap-2">
                            <Button className="min-w-0 flex-1 rounded-full" size="sm" asChild>
                              <Link to="/ler/$volumeId" params={{ volumeId: volume.id }}>
                                <BookOpen className="size-4" />
                                {percent > 0 ? "Continuar" : "Ler"}
                              </Link>
                            </Button>

                            {volume.file_format === "epub" ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="size-9 shrink-0 rounded-full"
                                aria-label={`Baixar Livro ${volume.number}`}
                                title={`Baixar Livro ${volume.number}`}
                                onClick={() => void downloadBookFile(volume)}
                              >
                                <Download className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Disponível após adquirir a coleção.
                          </p>
                        )}
                        {hasReadAccess ? readStatusAction(volume, "w-full text-xs") : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum livro foi publicado nesta coleção ainda.
              </div>
            )}
          </section>
        ) : (
          <section className="mt-8 space-y-5 sm:mt-12">
            <div className="sm:flex sm:items-end sm:justify-between sm:gap-6">
              <div>
                <p className="text-sm font-medium text-primary">Descobrir</p>
                <h2 className="font-display text-3xl">Livros parecidos</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Sugestões do catálogo com categorias e gêneros próximos desta leitura.
                </p>
              </div>

              {similarBooks.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 hidden shrink-0 rounded-full sm:inline-flex sm:mt-0"
                  asChild
                >
                  <Link
                    to="/marketplace"
                    search={{ seller: "", connect: "", similarTo: manga.id }}
                  >
                    Ver mais <ExternalLink className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>

            {similarBooks.length ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:hidden">
                  {similarBooks.slice(0, 6).map((book, index) => (
                    <PreferredMangaCard
                      key={book.id}
                      manga={book}
                      index={index}
                    />
                  ))}
                </div>

                <div className="hidden grid-cols-3 gap-4 sm:grid md:grid-cols-4 xl:grid-cols-5">
                  {similarBooks.slice(0, 5).map((book, index) => (
                    <div
                      key={book.id}
                      className={
                        index === 3
                          ? "hidden md:block"
                          : index === 4
                            ? "hidden xl:block"
                            : undefined
                      }
                    >
                      <PreferredMangaCard
                        manga={book}
                        index={index}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-card/60 px-4 py-10 text-center">
                <p className="text-sm font-medium">Ainda não encontramos livros parecidos.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  As sugestões aparecem conforme novos livros públicos entram no catálogo.
                </p>
              </div>
            )}
          </section>
        )
      ) : (
      <section id="volumes" className="mt-7 space-y-4 sm:mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-primary">Organização de leitura</p>
            <h2 className="font-display text-2xl">Volumes e capítulos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lista mais limpa, com progresso visível e ações rápidas.
            </p>
          </div>
          {isAdmin || manga.creator_id === user?.id ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/studio" search={{ obra: manga.id, aba: "volumes" }}>
                <Plus className="size-4" /> Adicionar volume ou capítulo
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Organização da obra">
          {[
            { value: "all", label: "Tudo" },
            { value: "volume", label: "Volumes" },
            { value: "chapter", label: "Capítulos" },
          ].map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={unitFilter === item.value ? "default" : "outline"}
              aria-pressed={unitFilter === item.value}
              onClick={() => setUnitFilter(item.value)}
              className="rounded-full"
            >
              {item.label}
            </Button>
          ))}
        </div>

        {hasReadAccess && collectionVolumes.length > 0 ? (
          <Button type="button" variant="outline" className="w-full min-h-11 rounded-xl" disabled={!!offlineProgress} onClick={() => void downloadWholeWork()}>
            <DownloadCloud className="size-4" /> Baixar obra completa
          </Button>
        ) : null}
        {offlineProgress?.volumeId === null ? (
          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <div className="flex justify-between text-xs"><span>{offlineProgress.label}</span><span>{Math.round((offlineProgress.completed/Math.max(1,offlineProgress.total))*100)}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${Math.round((offlineProgress.completed/Math.max(1,offlineProgress.total))*100)}%`}} /></div>
            <p className="mt-1 text-[11px] text-muted-foreground">{offlineProgress.completed}/{offlineProgress.total} páginas/arquivos</p>
          </div>
        ) : null}

        {orderedVolumes.length ? (
          <ul className="grid gap-3">
            {orderedVolumes.map((volume) => {
              const completed = isVolumeCompleted(volume);
              const percent = volumePercent(volume);
              const previewPage = firstPages.find((page) => page.volume_id === volume.id)?.storage_path;
              const isDownloading = offlineProgress?.volumeId === volume.id || offlineProgress?.volumeId === null;
              const hasOffline = offlineVolumeIds.includes(volume.id);
              return (
                <li
                  key={volume.id}
                  className="rounded-[1.6rem] border border-border/70 bg-card/70 p-3.5 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.92)] sm:p-3"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="w-full shrink-0 overflow-hidden rounded-[1.2rem] border border-border/60 [&>div]:h-[clamp(260px,78vw,440px)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover sm:w-28 sm:[&>div]:h-auto">
                      <PublicationCover
                        workType={manga.work_type}
                        coverUrl={volume.cover_url}
                        title={`${manga.title}, ${unitLabel(volume.unit_kind).toLowerCase()} ${volume.number}`}
                        fallbackPagePath={previewPage}
                        fallbackCoverUrl={manga.cover_url}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">
                          {unitLabel(volume.unit_kind)} {volume.number}
                        </p>
                        {hasReadAccess ? (
                          completed ? (
                            <Badge variant="secondary" className="rounded-full border border-white/5 bg-primary/10 text-primary shadow-none">
                              <CheckCircle2 className="size-3" /> Concluído
                            </Badge>
                          ) : percent > 0 ? (
                            <Badge variant="outline" className="rounded-full bg-background/55">
                              {percent}% lido
                            </Badge>
                          ) : null
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {displayPageCount(volume)} páginas
                        {hasReadAccess
                          ? percent > 0
                            ? ` · progresso salvo em ${percent}%`
                            : " · ainda não iniciado"
                          : " · disponível após adquirir a obra"}
                      </p>

                      {hasReadAccess ? (
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/85">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                        </div>
                      ) : null}

                      {hasReadAccess && isDownloading ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {volume.file_format === "epub" ? "Baixando livro completo…" : `Baixando ${offlineProgress.completed}/${offlineProgress.total} páginas…`}
                        </p>
                      ) : null}
                    </div>

                    {hasReadAccess ? (
                      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                      <Button
                        className="min-h-11 w-full sm:min-h-9 sm:w-[148px]"
                        size="sm"
                        variant="default"
                        asChild
                      >
                        <Link to="/ler/$volumeId" params={{ volumeId: volume.id }}>
                          <BookOpen className="size-4" /> {percent > 0 ? "Continuar" : "Ler"}
                        </Link>
                      </Button>
                      {readStatusAction(volume, "col-span-2 w-full sm:w-auto")}

                      <div className="col-span-2 grid w-full grid-cols-1 gap-2 sm:contents">
                        {volume.file_format === "epub" ? (
                          <Button
                            className="min-h-11 sm:min-h-9"
                            size="sm"
                            variant="outline"
                            disabled={isDownloading}
                            onClick={() => void downloadBookFile(volume)}
                          >
                            <Download className="size-4" />
                            <span>Baixar livro</span>
                          </Button>
                        ) : null}


                        {(volume.file_format === "epub" || isPlus) ? (
                          <Button
                            className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                            size="sm"
                            variant="outline"
                            disabled={isDownloading}
                            aria-label={hasOffline ? "Remover download offline" : "Baixar para leitura offline"}
                            title={
                              isDownloading
                                ? `${offlineProgress.completed}/${offlineProgress.total}`
                                : hasOffline
                                  ? "Remover download offline"
                                  : "Baixar para leitura offline"
                            }
                            onClick={() => void toggleOfflineVolume(volume)}
                          >
                            {hasOffline ? <Trash2 className="size-4" /> : <DownloadCloud className="size-4" />}
                            <span>{hasOffline ? "Remover offline" : "Baixar"}</span>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-[1.45rem] border border-dashed border-border/80 bg-card/60 px-4 py-10 text-center">
            <p className="text-sm font-medium">Nenhum volume ou capítulo publicado ainda.</p>
          </div>
        )}
      </section>

      )}

      <section className="mt-12 space-y-5">
        <div>
          <p className="text-sm font-medium text-primary">Comunidade</p>
          <h2 className="font-display text-2xl sm:text-3xl">Avaliações e comentários</h2>
          <p className="mt-1 text-sm text-muted-foreground">Veja o que os leitores acharam e participe da conversa.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <ReviewSection mangaId={manga.id} />
          <CommentSection mangaId={manga.id} title="Comentários da obra" />
        </div>
      </section>

      {isDirectCatalogSale ? (
        <CatalogPurchaseDialog
          open={purchaseOpen}
          onOpenChange={setPurchaseOpen}
          mangaId={manga.id}
          title={manga.title}
          priceCents={manga.price_cents}
          currency={manga.currency}
        />
      ) : null}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="h-full min-w-0 overflow-hidden rounded-[1.3rem] border border-border/70 bg-background/55 p-3 sm:p-4">
      <p className="min-w-0 break-words text-[10px] font-semibold leading-tight tracking-[0.1em] text-primary uppercase sm:text-xs sm:tracking-[0.16em]">{label}</p>
      <p className="mt-2 min-w-0 break-words text-base font-semibold leading-snug text-foreground sm:text-lg">{value}</p>
    </div>
  );
}
