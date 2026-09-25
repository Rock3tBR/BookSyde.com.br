import { ReaderPageNavigator } from "@/components/ReaderPageNavigator";
import { ReaderImagePreview } from "@/components/ReaderImagePreview";
import { useReaderLongPress } from "@/hooks/useReaderLongPress";
import { getReaderPages } from "@/lib/readerPages";
import { signReaderPages } from "@/lib/readerAccess";
import { Route } from "@/routes/ler.$volumeId";
import { lazy, Suspense } from "react";

import { unitLabel } from "@/lib/publication";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  CircleHelp,
  BookOpen,
  ExternalLink,
  Eye,
  EyeOff,
  MessageSquare,
  MoveDown,
  MoveHorizontal,
  Plus,
  Maximize2,
  Minimize2,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CommentSection } from "@/components/CommentSection";
import { startSystemTutorial } from "@/lib/tutorialEvents";
import { ShareWithFriends } from "@/components/ShareWithFriends";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, usePlus, useProfile } from "@/lib/auth";
import { getOfflinePageUrls, getOfflineVolume } from "@/lib/offlineVolumes";
import { useReadingTimeTracker } from "@/hooks/useReadingTimeTracker";
import { canUseRealFullscreen } from "@/lib/fullscreen";
import { MobileBookOpeningLottie } from "@/components/MobileBookOpeningLottie";

const DrivePdfReader = lazy(() => import("@/components/DrivePdfReader").then(({ DrivePdfReader }) => ({ default: DrivePdfReader })));
const EpubReader = lazy(() => import("@/components/EpubReader").then(({ EpubReader }) => ({ default: EpubReader })));

type ReadingDirection = "manga" | "book";
type ReadingMode = "paged" | "vertical";
type PageTransition = "page_turn" | "instant";
type PageTurn = { targetIndex: number; direction: "left" | "right" };

const AD_INTERVAL = 5;
const AD_WAIT_SECONDS = 5;
const PAGE_CHUNK = 12;

export function PublicationReader() {
  const { volumeId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["publication-format", volumeId],
    networkMode: "always",
    queryFn: async () => {
      const offline = getOfflineVolume(volumeId);
      if (offline) return { file_format: offline.fileFormat ?? "images", isDrive: false };
      const result = await supabase
        .from("volumes")
        .select("file_format")
        .eq("id", volumeId)
        .single();
      if (result.error) throw result.error;
      // Todo PDF usa o leitor de arquivo-fonte. Esse leitor resolve a origem no
      // servidor (Google Drive ou Supabase) sem depender da tabela `pages`.
      // Assim volumes importados do Drive nunca caem no leitor de imagens.
      return { ...result.data, isDrive: result.data.file_format === "pdf" };
    },
  });
  if (isLoading) return <MobileBookOpeningLottie />;
  if (error)
    return (
      <p role="alert" className="p-8">
        Não foi possível abrir a publicação. {error.message}
      </p>
    );
  return data?.isDrive ? (
    <Suspense fallback={<MobileBookOpeningLottie />}><DrivePdfReader key={volumeId} volumeId={volumeId} /></Suspense>
  ) : data?.file_format === "epub" ? (
    <Suspense fallback={<MobileBookOpeningLottie />}><EpubReader key={volumeId} volumeId={volumeId} /></Suspense>
  ) : (
    <ReaderPage key={volumeId} />
  );
}

function ReaderPage() {
  const { volumeId } = Route.useParams();
  const { user, session } = useAuth();
  const { data: profile, isFetched: profileFetched } = useProfile();
  const { data: isPlus = false } = usePlus();
  const navigate = useNavigate();
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const [index, setIndex] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [readingDirection, setReadingDirection] = useState<ReadingDirection>("manga");
  const [readingMode, setReadingMode] = useState<ReadingMode>("paged");
  const [pageTransition, setPageTransition] = useState<PageTransition>("page_turn");
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [readerBackground, setReaderBackground] = useState<"black" | "gray" | "sepia">("black");
  const [turnSpeed, setTurnSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [progressStyle, setProgressStyle] = useState<"hidden" | "minimal" | "full">("full");
  const [hideComments, setHideComments] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [autoNextVolume, setAutoNextVolume] = useState(true);
  const [progressReady, setProgressReady] = useState(false);
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("Melhores momentos");
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [adVisible, setAdVisible] = useState(false);
  const [adCountdown, setAdCountdown] = useState(AD_WAIT_SECONDS);
  const [pageAfterAd, setPageAfterAd] = useState<number | null>(null);
  const [pageTurn, setPageTurn] = useState<PageTurn | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const readerRef = useRef<HTMLDivElement>(null);
  const verticalScrollRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const completedAtRef = useRef<string | null>(null);
  const shownAdsRef = useRef(new Set<number>());
  const pageTurnTimerRef = useRef<number | null>(null);

  const longPress = useReaderLongPress(() => {
    if (adVisible || onboardingVisible || pageTurn || zoomed) return;
    cancelGesture();
    lastTapRef.current = null;
    setChromeVisible(false);
    setNavigatorOpen(true);
  });

  useReadingTimeTracker({
    volumeId,
    userId: user?.id ?? null,
    enabled: !!user && !isOffline,
  });

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Mantém o leitor estável se o navegador interromper a saída.
    }
    setImmersiveMode(false);
    setChromeVisible(true);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!canUseRealFullscreen()) return;

    const target = (readerRef.current ?? document.documentElement) as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };

    if (document.fullscreenElement) {
      await exitFullscreen();
      return;
    }

    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen({ navigationUI: "hide" });
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      } else if (target.msRequestFullscreen) {
        await target.msRequestFullscreen();
      } else {
        return;
      }
      setImmersiveMode(true);
      setChromeVisible(false);
    } catch {
      // Sem modo imersivo falso: o controle só aparece quando há fullscreen real.
    }
  }, [exitFullscreen]);

  useEffect(() => {
    setFullscreenAvailable(canUseRealFullscreen());
  }, []);

  useEffect(() => {
    if (readingMode === "vertical") setChromeVisible(false);
  }, [readingMode]);

  useEffect(() => {
    const syncFullscreenState = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) setImmersiveMode(false);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    if (!immersiveMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void exitFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitFullscreen, immersiveMode]);

  const { data: volume } = useQuery({
    queryKey: ["volume", volumeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const offline = getOfflineVolume(volumeId);
      if (offline && typeof navigator !== "undefined" && !navigator.onLine) {
        return {
          id: offline.volumeId,
          number: offline.volumeNumber,
          unit_kind: "volume",
          page_count: offline.pages.length,
          manga_id: offline.mangaId,
          mangas: { slug: offline.mangaSlug, title: offline.mangaTitle, work_type: offline.workType ?? "manga" },
        };
      }
      const { data, error } = await supabase
        .from("volumes")
        .select("id, number, unit_kind, page_count, manga_id, mangas(slug, title, work_type)")
        .eq("id", volumeId)
        .maybeSingle();
      if (error) {
        if (offline) {
          return {
            id: offline.volumeId,
            number: offline.volumeNumber,
            unit_kind: "volume",
            page_count: offline.pages.length,
            manga_id: offline.mangaId,
            mangas: { slug: offline.mangaSlug, title: offline.mangaTitle, work_type: offline.workType ?? "manga" },
          };
        }
        throw error;
      }
      return data;
    },
  });

  const { data: pages = [], error: pagesError, isLoading: loadingPages } = useQuery({
    queryKey: ["pages", volumeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const offline = getOfflineVolume(volumeId);
      if (offline && typeof navigator !== "undefined" && !navigator.onLine) return offline.pages;
      try {
        return await getReaderPages([volumeId]);
      } catch (error) {
        if (offline) return offline.pages;
        throw error;
      }
    },
  });

  const { data: nextVolume } = useQuery({
    queryKey: ["next-volume", volume?.manga_id, volume?.number, volume?.unit_kind],
    enabled: !isOffline && !!volume?.manga_id && typeof volume?.number === "number",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volumes")
        .select("id, number")
        .eq("manga_id", volume!.manga_id)
        .eq("unit_kind", volume!.unit_kind as "volume" | "chapter")
        .eq("published", true)
        .gt("number", volume!.number)
        .order("number")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const allowedCount = pages.length;

  const visiblePages = pages.slice(0, allowedCount);

  const chunkStart = Math.max(0, Math.floor(index / PAGE_CHUNK) * PAGE_CHUNK - PAGE_CHUNK);
  const urlMapRef = useRef<Record<number, string>>({});
  const [urlMap, setUrlMap] = useState<Record<number, string>>({});

  useEffect(() => {
    urlMapRef.current = {};
    setUrlMap({});
  }, [volumeId]);

  const {
    data: signedPageMap,
    error: signedUrlsError,
    refetch: refetchSignedUrls,
  } = useQuery({
    queryKey: ["signed-pages", volumeId, chunkStart, !!session?.access_token],
    enabled: visiblePages.length > 0 && preferenceLoaded,
    // As URLs expiram em 60 minutos; reaproveite-as quase até o vencimento.
    staleTime: isOffline ? 0 : 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      // Assina apenas uma janela de páginas ao redor da leitura atual: pedir o
      // volume inteiro falha quando alguma página não é liberada para o leitor.
      const slice = visiblePages.slice(chunkStart, chunkStart + PAGE_CHUNK * 3);
      const cachedUrls = await getOfflinePageUrls(volumeId, slice);
      const missing = slice
        .map((page, position) => (cachedUrls[position] ? null : page.storage_path))
        .filter((path): path is string => !!path);

      const signed: Record<string, string> = {};
      if (missing.length) {
        if (isOffline) {
          throw new Error(
            "O download deste volume está incompleto. Conecte-se à internet e baixe-o novamente.",
          );
        }
        const urls = await signReaderPages(volumeId, missing);
        Object.entries(urls).forEach(([path, url]) => {
          if (url) signed[path] = url;
        });
      }

      const resolved: Record<number, string> = {};
      slice.forEach((page, position) => {
        const url = cachedUrls[position] ?? signed[page.storage_path];
        if (url) resolved[chunkStart + position] = url;
      });

      urlMapRef.current = { ...urlMapRef.current, ...resolved };
      setUrlMap(urlMapRef.current);

      if (!urlMapRef.current[index]) {
        throw new Error("Não foi possível liberar o acesso a esta página.");
      }
      return resolved;
    },
  });

  useEffect(() => {
    if (!signedPageMap) return;
    urlMapRef.current = { ...urlMapRef.current, ...signedPageMap };
    setUrlMap(urlMapRef.current);
  }, [signedPageMap]);

  const signedUrls = visiblePages.map((_, position) => urlMap[position] ?? "");

  useEffect(() => {
    if (readingMode !== "vertical" || !verticalScrollRef.current || !visiblePages.length) return;
    const root = verticalScrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const nextIndex = Number((visible.target as HTMLElement).dataset["readerPage"]);
        if (Number.isInteger(nextIndex)) setIndex(nextIndex);
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    );
    root.querySelectorAll<HTMLElement>("[data-reader-page]").forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [readingMode, visiblePages.length]);

  useEffect(() => {
    if (readingMode !== "vertical" || !progressReady || !verticalScrollRef.current) return;
    const root = verticalScrollRef.current;
    const frame = window.requestAnimationFrame(() => {
      root.querySelector<HTMLElement>(`[data-reader-page="${index}"]`)?.scrollIntoView({
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
    // Roda ao entrar no modo vertical ou restaurar o volume; mudanças de index pelo scroll não devem reposicionar a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingMode, progressReady, volumeId]);

  const { data: remoteProgress, isFetched: remoteProgressFetched } = useQuery({
    queryKey: ["reading-progress", user?.id, volumeId],
    enabled: !!user && !isOffline,
    queryFn: async () => {
      const withCompletion = await supabase
        .from("reading_progress")
        .select("page_index, completed_at, updated_at")
        .eq("user_id", user!.id)
        .eq("volume_id", volumeId)
        .maybeSingle();
      if (!withCompletion.error) return withCompletion.data;
      if (!withCompletion.error.message.includes("completed_at")) throw withCompletion.error;
      const fallback = await supabase
        .from("reading_progress")
        .select("page_index, updated_at")
        .eq("user_id", user!.id)
        .eq("volume_id", volumeId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      return fallback.data ? { ...fallback.data, completed_at: null } : null;
    },
  });

  const { data: bookmarkCollections = [], refetch: refetchCollections } = useQuery({
    queryKey: ["bookmark-collections", user?.id],
    enabled: !!user && bookmarkDialogOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmark_collections")
        .select("id, name")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const changePage = useCallback(
    (targetIndex: number, direction: "left" | "right") => {
      if (pageTransition === "instant") {
        setIndex(targetIndex);
        return;
      }
      setPageTurn({ targetIndex, direction });
      pageTurnTimerRef.current = window.setTimeout(
        () => {
          setIndex(targetIndex);
          setPageTurn(null);
          pageTurnTimerRef.current = null;
        },
        turnSpeed === "slow" ? 760 : turnSpeed === "fast" ? 320 : 540,
      );
    },
    [pageTransition, turnSpeed],
  );

  const goNext = useCallback(() => {
    if (adVisible || pageTurn) return;
    const nextIndex = Math.min(index + 1, Math.max(visiblePages.length - 1, 0));
    if (nextIndex === index) {
      if (autoNextVolume && nextVolume) {
        toast.success(`Abrindo Volume: ${nextVolume.number}`);
        void navigate({ to: "/ler/$volumeId", params: { volumeId: nextVolume.id }, replace: true });
      }
      return;
    }

    const pagesRead = index + 1;
    if (!isPlus && pagesRead % AD_INTERVAL === 0 && !shownAdsRef.current.has(pagesRead)) {
      shownAdsRef.current.add(pagesRead);
      setPageAfterAd(nextIndex);
      setAdCountdown(AD_WAIT_SECONDS);
      setChromeVisible(false);
      setAdVisible(true);
      return;
    }

    changePage(nextIndex, readingDirection === "manga" ? "right" : "left");
  }, [
    adVisible,
    autoNextVolume,
    changePage,
    index,
    isPlus,
    navigate,
    nextVolume,
    pageTurn,
    readingDirection,
    visiblePages.length,
  ]);
  const goPrev = useCallback(() => {
    if (adVisible || pageTurn || index === 0) return;
    changePage(index - 1, readingDirection === "manga" ? "left" : "right");
  }, [adVisible, changePage, index, pageTurn, readingDirection]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (user && !profileFetched) return;
    const completedLocally = window.localStorage.getItem("mangaka-reader-onboarding") === "done";
    const completedInProfile = profile?.reader_onboarding_completed === true;
    setOnboardingVisible(!completedLocally && !completedInProfile);
  }, [profile?.reader_onboarding_completed, profileFetched, user]);

  useEffect(() => {
    setReadingMode(
      window.localStorage.getItem("mangaka-reading-mode") === "vertical" ? "vertical" : "paged",
    );
    setPageTransition(
      window.localStorage.getItem("mangaka-page-transition") === "instant"
        ? "instant"
        : "page_turn",
    );
    setShowProgress(window.localStorage.getItem("mangaka-show-progress") !== "false");
    setBrightness(Number(window.localStorage.getItem("mangaka-reader-brightness")) || 100);
    const savedBackground = window.localStorage.getItem("mangaka-reader-background");
    setReaderBackground(
      savedBackground === "gray" || savedBackground === "sepia" ? savedBackground : "black",
    );
    const savedSpeed = window.localStorage.getItem("mangaka-page-turn-speed");
    setTurnSpeed(savedSpeed === "slow" || savedSpeed === "fast" ? savedSpeed : "normal");
    const savedProgressStyle = window.localStorage.getItem("mangaka-progress-style");
    setProgressStyle(
      savedProgressStyle === "hidden" || savedProgressStyle === "minimal"
        ? savedProgressStyle
        : "full",
    );
    setHideComments(window.localStorage.getItem("mangaka-hide-reader-comments") === "true");
    setDataSaver(window.localStorage.getItem("mangaka-data-saver") === "true");
    setAutoNextVolume(window.localStorage.getItem("mangaka-auto-next-volume") !== "false");
    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!profile) return;
    setBrightness(profile.reader_brightness ?? 100);
    setReaderBackground(
      profile.reader_background === "gray" || profile.reader_background === "sepia"
        ? profile.reader_background
        : "black",
    );
    setTurnSpeed(
      profile.page_turn_speed === "slow" || profile.page_turn_speed === "fast"
        ? profile.page_turn_speed
        : "normal",
    );
    setProgressStyle(
      profile.progress_style === "hidden" || profile.progress_style === "minimal"
        ? profile.progress_style
        : "full",
    );
    setShowProgress(profile.progress_style !== "hidden" && profile.show_progress);
    setHideComments(profile.hide_reader_comments ?? false);
    setDataSaver(profile.data_saver ?? false);
    setAutoNextVolume(profile.auto_next_volume ?? true);
  }, [profile]);

  useEffect(() => {
    const workType = (volume?.mangas as { work_type?: string } | null)?.work_type;
    if (!workType) return;
    // Mangás mantêm a leitura tradicional da direita para a esquerda.
    // HQs, gibis e livros são sempre da esquerda para a direita.
    setReadingDirection(workType === "manga" ? "manga" : "book");
  }, [volume]);

  useEffect(() => {
    if (!preferenceLoaded) return;
    window.localStorage.setItem("mangaka-reading-mode", readingMode);
  }, [preferenceLoaded, readingMode]);

  useEffect(() => {
    if (!preferenceLoaded) return;
    window.localStorage.setItem("mangaka-page-transition", pageTransition);
  }, [pageTransition, preferenceLoaded]);

  useEffect(
    () => () => {
      if (pageTurnTimerRef.current !== null) window.clearTimeout(pageTurnTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!preferenceLoaded) return;
    window.localStorage.setItem("mangaka-show-progress", String(showProgress));
  }, [preferenceLoaded, showProgress]);

  useEffect(() => {
    if (pageTurnTimerRef.current !== null) {
      window.clearTimeout(pageTurnTimerRef.current);
      pageTurnTimerRef.current = null;
    }
    setProgressReady(false);
    completedAtRef.current = null;
    shownAdsRef.current.clear();
    setAdVisible(false);
    setPageAfterAd(null);
    setPageTurn(null);
  }, [volumeId]);

  useEffect(() => {
    if (!adVisible || adCountdown <= 0) return;
    const timeout = window.setTimeout(() => {
      setAdCountdown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [adCountdown, adVisible]);

  useEffect(() => {
    if (!allowedCount || (user && !isOffline && !remoteProgressFetched)) return;

    const localValue = window.localStorage.getItem(`mangaka-page-${volumeId}`);
    const localUpdatedAt = Number(
      window.localStorage.getItem(`mangaka-page-updated-${volumeId}`),
    );
    const localPage = localValue === null ? 0 : Number(localValue);
    const sharedPage = Number(new URLSearchParams(window.location.search).get("pagina"));

    let savedPage = Number.isFinite(localPage) && localPage >= 0 ? localPage : 0;

    if (sharedPage > 0) {
      savedPage = sharedPage - 1;
    } else if (typeof remoteProgress?.page_index === "number") {
      const remoteUpdatedAt = remoteProgress.updated_at
        ? new Date(remoteProgress.updated_at).getTime()
        : 0;
      const hasNewerLocalProgress =
        Number.isFinite(localUpdatedAt) &&
        localUpdatedAt > 0 &&
        localUpdatedAt > remoteUpdatedAt;

      if (!hasNewerLocalProgress) savedPage = remoteProgress.page_index;
    }

    if (Number.isInteger(savedPage) && savedPage >= 0) {
      setIndex(Math.min(savedPage, allowedCount - 1));
    }
    completedAtRef.current = remoteProgress?.completed_at ?? null;
    setProgressReady(true);
  }, [allowedCount, isOffline, remoteProgress, remoteProgressFetched, user, volumeId]);

  useEffect(() => {
    if (!progressReady || !allowedCount || index >= allowedCount) return;
    window.localStorage.setItem(`mangaka-page-${volumeId}`, String(index));
    window.localStorage.setItem(`mangaka-page-updated-${volumeId}`, String(Date.now()));
    if (!user || isOffline) return;

    const timeout = window.setTimeout(async () => {
      if (index + 1 >= allowedCount && !completedAtRef.current) {
        completedAtRef.current = new Date().toISOString();
      }
      const progressPayload = {
        user_id: user.id,
        volume_id: volumeId,
        page_index: index,
        updated_at: new Date().toISOString(),
      };
      const result = await supabase
        .from("reading_progress")
        .upsert(
          { ...progressPayload, completed_at: completedAtRef.current },
          { onConflict: "user_id,volume_id" },
        );
      if (result.error?.message.includes("completed_at")) {
        const fallback = await supabase
          .from("reading_progress")
          .upsert(progressPayload, { onConflict: "user_id,volume_id" });
        if (fallback.error) {
          console.error("Não foi possível salvar o progresso de leitura", fallback.error);
        }
      } else if (result.error) {
        console.error("Não foi possível salvar o progresso de leitura", result.error);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [allowedCount, index, isOffline, progressReady, user, volumeId]);

  useEffect(() => {
    // Mantém as páginas mais prováveis no cache do navegador antes do gesto.
    const preloadAhead = dataSaver ? 1 : isPlus ? 10 : 2;
    const nearbyUrls = [
      ...signedUrls.slice(index + 1, index + 1 + preloadAhead),
      signedUrls[index - 1],
    ].filter((url): url is string => !!url);

    nearbyUrls.forEach((url) => {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      void image.decode().catch(() => undefined);
    });
  }, [dataSaver, index, isPlus, signedUrls]);

  function openBookmarkDialog() {
    if (!user) {
      toast.error("Entre na sua conta para salvar páginas em coleções");
      return;
    }
    setBookmarkDialogOpen(true);
    setChromeVisible(false);
  }

  async function saveBookmark(collectionId: string) {
    if (!user) return;
    setSavingBookmark(true);
    const { error } = await supabase.from("page_bookmarks").upsert(
      {
        user_id: user.id,
        collection_id: collectionId,
        volume_id: volumeId,
        page_index: index,
      },
      { onConflict: "collection_id,volume_id,page_index", ignoreDuplicates: true },
    );
    setSavingBookmark(false);
    if (error) {
      toast.error("Não foi possível salvar esta página");
      return;
    }
    toast.success(`Página ${index + 1} adicionada à coleção`);
    setBookmarkDialogOpen(false);
  }

  async function createCollectionAndSave() {
    if (!user || !newCollectionName.trim()) return;
    setSavingBookmark(true);
    const { data, error } = await supabase
      .from("bookmark_collections")
      .insert({ user_id: user.id, name: newCollectionName.trim() })
      .select("id")
      .single();
    if (error || !data) {
      setSavingBookmark(false);
      toast.error("Não foi possível criar a coleção. Talvez esse nome já exista.");
      return;
    }
    await refetchCollections();
    await saveBookmark(data.id);
  }

  useEffect(() => {
    setZoomed(false);
  }, [index, readingMode]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (pageTurn || adVisible) return;
    if (!event.isPrimary) { cancelGesture(); return; }
    if (event.pointerType === "mouse" && event.button !== 0) return;

    // Duplo toque (páginas em modo "paged") amplia a página atual, útil
    // para ler detalhes/texto pequeno em telas de celular. Um novo toque
    // enquanto ampliado apenas fecha o zoom, sem virar página.
    const now = Date.now();
    const lastTap = lastTapRef.current;
    const isDoubleTap =
      readingMode === "paged" &&
      !!lastTap &&
      now - lastTap.time < 320 &&
      Math.abs(event.clientX - lastTap.x) < 32 &&
      Math.abs(event.clientY - lastTap.y) < 32;
    lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };

    if (isDoubleTap) {
      lastTapRef.current = null;
      setZoomed((current) => !current);
      return;
    }

    if (zoomed) {
      setZoomed(false);
      return;
    }

    longPress.onPointerDown(event);
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    longPress.onPointerMove(event);
    if (!dragStartRef.current || zoomed) return;
    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) setDragOffset(deltaX);
  }

  function finishGesture(event: ReactPointerEvent<HTMLDivElement>) {
    longPress.cancel();
    if (longPress.triggered.current) { cancelGesture(); return; }
    const start = dragStartRef.current;
    if (!start || zoomed) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const swipeThreshold = Math.min(90, window.innerWidth * 0.18);
    const isHorizontalSwipe =
      Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY);
    const isVerticalSwipe = Math.abs(deltaY) > 70 && Math.abs(deltaY) > Math.abs(deltaX);

    if (isHorizontalSwipe) {
      const movingForward = readingDirection === "manga" ? deltaX > 0 : deltaX < 0;
      if (movingForward) goNext();
      else goPrev();
      setChromeVisible(false);
    } else if (isVerticalSwipe) {
      setChromeVisible(deltaY > 0);
    } else if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
      setChromeVisible((visible) => !visible);
    }

    dragStartRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }

  function cancelGesture() {
    longPress.cancel();
    dragStartRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }

  function continueAfterAd() {
    if (adCountdown > 0 || pageAfterAd === null) return;
    const targetIndex = pageAfterAd;
    setPageAfterAd(null);
    setAdVisible(false);
    changePage(targetIndex, readingDirection === "manga" ? "right" : "left");
  }

  async function finishOnboarding() {
    window.localStorage.setItem("mangaka-reader-onboarding", "done");
    setOnboardingVisible(false);
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ reader_onboarding_completed: true })
      .eq("id", user.id);
    if (error) console.error("Não foi possível sincronizar o tutorial do leitor", error);
  }

  const mangaSlug = (volume?.mangas as { slug?: string } | null)?.slug;
  const readerBackgroundColor =
    readerBackground === "sepia" ? "#c8b894" : readerBackground === "gray" ? "#353535" : "#050505";
  const dragRatio =
    typeof window === "undefined"
      ? 0
      : Math.max(-1, Math.min(1, dragOffset / Math.max(window.innerWidth, 1)));
  const draggingPageStyle = pageTurn
    ? undefined
    : {
        transform: `translateX(${dragOffset * 0.22}px) rotateY(${dragRatio * -24}deg)`,
        transformOrigin: dragOffset < 0 ? "left center" : "right center",
      };

  return (
    <div
      ref={readerRef}
      className={`fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none ${
        immersiveMode || isFullscreen ? "reader-immersive" : ""
      }`}
      style={{ backgroundColor: readerBackgroundColor }}
    >

      <div
        inert={!chromeVisible}
        aria-hidden={!chromeVisible}
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 transition-all duration-300 ${
          chromeVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <div
          data-tour="reader-controls"
          className="pointer-events-auto border-b border-white/10 bg-[#171717]/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-[0_12px_35px_rgba(0,0,0,.3)] backdrop-blur-xl sm:px-5"
        >
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 sm:flex">
              <BookOpen className="size-[18px] text-white/75" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">
                {(volume?.mangas as { title?: string } | null)?.title ?? "Leitura"}
              </p>
              <p className="mt-0.5 truncate text-[11px] tabular-nums text-white/55">
                {volume
                  ? `${unitLabel(volume.unit_kind)} ${volume.number} · Página ${index + 1} de ${visiblePages.length || 1}`
                  : "Carregando…"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-xl border border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link
                to="/manga/$slug"
                params={{ slug: mangaSlug ?? "" }}
                search={{ invite: "" }}
                aria-label="Fechar leitura"
                title="Voltar às informações da obra"
              >
                <X className="size-[18px]" />
              </Link>
            </Button>
          </div>

          <div className="mx-auto mt-3 flex max-w-4xl items-center justify-between gap-2 border-t border-white/10 pt-3">
            <div role="group" aria-label="Modo de leitura" className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setReadingMode("paged")}
                aria-pressed={readingMode === "paged"}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors sm:px-3 ${
                  readingMode === "paged"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/55 hover:bg-white/10 hover:text-white"
                }`}
              >
                <MoveHorizontal className="size-3.5" /> Páginas
              </button>
              <button
                type="button"
                onClick={() => { setReadingMode("vertical"); setChromeVisible(false); }}
                aria-pressed={readingMode === "vertical"}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors sm:px-3 ${
                  readingMode === "vertical"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/55 hover:bg-white/10 hover:text-white"
                }`}
              >
                <MoveDown className="size-3.5" /> Scroll
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-xl border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                    aria-label="Configurações da leitura"
                    title="Configurações da leitura"
                  >
                    <Settings2 className="size-[18px]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" sideOffset={12} className="z-[70] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border-white/15 bg-[#202020] p-4 text-white shadow-2xl">
                  <p className="text-sm font-semibold">Configurações da leitura</p>
                  <p className="mt-1 text-xs text-white/55">Ajustes e ações do leitor.</p>

                  <div className="mt-4 grid gap-2">
                    <label className="text-xs font-medium text-white/70">Brilho · {brightness}%</label>
                    <input
                      type="range"
                      min="45"
                      max="120"
                      value={brightness}
                      onChange={(event) => setBrightness(Number(event.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="mb-2 text-xs font-medium text-white/70">Fundo</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["black", "Preto", "#050505"],
                        ["gray", "Cinza", "#353535"],
                        ["sepia", "Sépia", "#c8b894"],
                      ] as const).map(([value, label, color]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReaderBackground(value)}
                          className={`rounded-xl border p-2 text-[11px] ${readerBackground === value ? "border-white/65 bg-white/10" : "border-white/10 text-white/60"}`}
                        >
                          <span className="mx-auto mb-1 block size-6 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
                    <Button variant="ghost" className="justify-start text-white hover:bg-white/10 hover:text-white" onClick={openBookmarkDialog}>
                      <Bookmark className="size-4" /> Salvar página
                    </Button>
                    {volume && visiblePages[index] ? (
                      <ShareWithFriends
                        type="page"
                        title={`${(volume.mangas as { title?: string } | null)?.title ?? "Mangá"} · ${unitLabel(volume.unit_kind)}: ${volume.number} · Página ${index + 1}`}
                        path={`/ler/${volumeId}?pagina=${index + 1}`}
                        mangaId={volume.manga_id}
                        volumeId={volume.id}
                        pageId={visiblePages[index]!.id}
                        triggerLabel="Compartilhar página"
                        triggerClassName="w-full justify-start border-0 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      />
                    ) : null}
                    {!hideComments ? (
                      <Button variant="ghost" className="justify-start text-white hover:bg-white/10 hover:text-white" onClick={() => setCommentsOpen(true)}>
                        <MessageSquare className="size-4" /> Comentários
                      </Button>
                    ) : null}
                    <Button variant="ghost" className="justify-start text-white hover:bg-white/10 hover:text-white" onClick={() => setShowProgress((shown) => !shown)}>
                      {showProgress ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      {showProgress ? "Ocultar progresso" : "Mostrar progresso"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {fullscreenAvailable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-xl border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white sm:w-auto sm:px-3"
                  onClick={() => void toggleFullscreen()}
                  aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                  title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                >
                  {isFullscreen ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
                  <span className="hidden text-xs font-medium sm:inline">Tela cheia</span>
                </Button>
              ) : null}

              <Button variant="ghost" size="icon" className="size-10 rounded-xl text-white/75 hover:bg-white/10 hover:text-white" aria-label="Navegar pelas páginas" title="Navegar pelas páginas — segure a tela" disabled={!visiblePages.length || adVisible} onClick={() => { setChromeVisible(false); setNavigatorOpen(true); }}>
                <BookOpen className="size-[18px]" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-xl text-white/65 hover:bg-white/10 hover:text-white"
                onClick={() => startSystemTutorial("reader")}
                aria-label="Ajuda com o leitor"
                title="Ajuda com o leitor"
              >
                <CircleHelp className="size-[18px]" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Página */}
      <div
        data-tour="reader-page"
        className="relative flex-1 overflow-hidden"
        style={{ filter: `brightness(${brightness}%)` }}
      >
        {!pages.length ? (
          loadingPages ? <MobileBookOpeningLottie /> : (
            <p role={pagesError ? "alert" : "status"} className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {pagesError ? `Não foi possível consultar as páginas: ${pagesError.message}` : "Nenhuma página disponível para esta conta."}
            </p>
          )
        ) : readingMode === "vertical" ? (
          <div
            ref={verticalScrollRef}
            className="h-full w-full overflow-y-auto overscroll-y-contain bg-black/20"
            style={{ WebkitOverflowScrolling: "touch", WebkitTouchCallout: "none", userSelect: "none" }}
            onPointerDown={longPress.onPointerDown}
            onPointerMove={longPress.onPointerMove}
            onPointerUp={longPress.cancel}
            onPointerCancel={longPress.cancel}
            onContextMenu={(event) => event.preventDefault()}
            onScroll={() => { longPress.cancel(); setChromeVisible(false); }}
            onClick={() => { if (!longPress.triggered.current) setChromeVisible((visible) => !visible); }}
          >
            <div className="mx-auto w-full max-w-[1100px]">
              {visiblePages.map((page, pageIndex) => (
                <section
                  key={page.id}
                  data-reader-page={pageIndex}
                  className="relative flex min-h-[62dvh] w-full items-center justify-center border-b border-white/5 bg-[var(--color-paper)]"
                >
                  {signedUrls[pageIndex] ? (
                    <img
                      src={signedUrls[pageIndex]}
                      alt={`Página ${pageIndex + 1}`}
                      className="block h-auto w-full select-none object-contain"
                      decoding="async"
                      draggable={false}
                      loading={Math.abs(pageIndex - index) <= 2 ? "eager" : "lazy"}
                    />
                  ) : (
                    <div className="flex min-h-[62dvh] w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/50">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                        Página {pageIndex + 1}
                      </span>
                      <span>{signedUrlsError && pageIndex === index ? "Não foi possível carregar esta página." : "Carregando…"}</span>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="reader-page reader-perspective relative h-full w-full touch-none overflow-hidden select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishGesture}
            onPointerCancel={cancelGesture}
            onContextMenu={(event) => event.preventDefault()}
            style={{ WebkitTouchCallout: "none" }}
          >
            {pageTurn && signedUrls[pageTurn.targetIndex] ? (
              <div
                className={`reader-page-reveal absolute inset-0 ${pageTurn.direction === "left" ? "reader-reveal-left" : "reader-reveal-right"}`}
              >
                <img
                  src={signedUrls[pageTurn.targetIndex]}
                  alt={`Página ${pageTurn.targetIndex + 1}`}
                  className="mx-auto h-full w-auto max-w-full select-none object-contain"
                  decoding="async"
                  draggable={false}
                />
              </div>
            ) : null}
            {signedUrls[index] ? (
              <div
                className={`relative z-10 h-full w-full bg-[var(--color-paper)] ${
                  pageTurn
                    ? pageTurn.direction === "left"
                      ? "reader-turn-left"
                      : "reader-turn-right"
                    : isDragging
                      ? ""
                      : "transition-transform duration-200 ease-out"
                }`}
                style={zoomed ? { transform: "scale(2.2)" } : draggingPageStyle}
              >
                <img
                  src={signedUrls[index]}
                  alt={`Página ${index + 1}`}
                  className="mx-auto h-full w-auto max-w-full select-none object-contain"
                  decoding="async"
                  draggable={false}
                  fetchPriority="high"
                  loading="eager"
                />
                {pageTurn ? (
                  <>
                    <span className="reader-page-fold pointer-events-none absolute inset-y-0" />
                    <span className="reader-page-edge pointer-events-none absolute inset-y-0" />
                  </>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-paper-foreground/60">
                <p>
                  {signedUrlsError
                    ? isOffline
                      ? signedUrlsError.message
                      : "Não foi possível carregar esta página."
                    : "Carregando página…"}
                </p>
                {signedUrlsError ? (
                  <Button variant="outline" size="sm" onClick={() => void refetchSignedUrls()}>
                    Tentar novamente
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {navigatorOpen && visiblePages.length > 0 ? (
        <ReaderPageNavigator
          current={index}
          count={visiblePages.length}
          container={readerRef.current}
          onClose={() => setNavigatorOpen(false)}
          onNavigate={(page) => {
            setIndex(page);
            setChromeVisible(false);
            if (readingMode === "vertical") {
              verticalScrollRef.current?.querySelector<HTMLElement>(`[data-reader-page="${page}"]`)?.scrollIntoView({ block: "start" });
            }
          }}
          renderPreview={(page) => <ReaderImagePreview volumeId={volumeId} page={visiblePages[page]!} cachedUrl={signedUrls[page]} />}
        />
      ) : null}

      {zoomed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
          Toque para sair do zoom
        </div>
      ) : null}

      {chromeVisible && readingMode === "paged" && pages.length > 0 && !adVisible ? (
        <div data-tour="reader-navigation" className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8">
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-black/75 p-2 text-white shadow-2xl backdrop-blur-xl">
            <Button
              variant="ghost"
              className="flex-1 text-white hover:bg-white/10 hover:text-white"
              disabled={index === 0}
              onClick={goPrev}
            >
              Anterior
            </Button>
            <span className="min-w-16 text-center text-xs font-medium text-white/65">
              {index + 1}/{visiblePages.length}
            </span>
            <Button
              variant="ghost"
              className="flex-1 text-white hover:bg-white/10 hover:text-white"
              onClick={goNext}
            >
              {index + 1 >= visiblePages.length && nextVolume ? "Próximo" : "Próxima"}
            </Button>
          </div>
        </div>
      ) : null}

      {showProgress && progressStyle !== "hidden" && pages.length > 0 ? (
        progressStyle === "minimal" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-white/10">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((index + 1) / visiblePages.length) * 100}%` }}
            />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/65 to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 text-xs font-medium text-white/90">
            <span>
              {index + 1}/{visiblePages.length}
            </span>
            <span>{Math.round(((index + 1) / visiblePages.length) * 100)}%</span>
          </div>
        )
      ) : null}

      {adVisible ? (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center bg-black/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Anúncio"
        >
          <div className="w-full max-w-lg rounded-xl border border-white/15 bg-neutral-900 p-4 text-center text-white shadow-2xl sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
              Publicidade
            </p>
            <div
              id="reader-interstitial-ad"
              data-ad-slot="reader-every-five-pages"
              className="mt-4 flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-neutral-800"
            >
              {import.meta.env["VITE_READER_AD_IMAGE_URL"] ? (
                <a
                  href={import.meta.env["VITE_READER_AD_TARGET_URL"] || "#"}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="group relative block size-full min-h-64"
                >
                  <img
                    src={import.meta.env["VITE_READER_AD_IMAGE_URL"]}
                    alt={import.meta.env["VITE_READER_AD_ALT"] || "Anúncio do patrocinador"}
                    className="absolute inset-0 size-full object-contain"
                  />
                  <ExternalLink className="absolute right-3 top-3 size-5 rounded bg-black/60 p-1 opacity-70 group-hover:opacity-100" />
                </a>
              ) : (
                <div className="px-6 text-sm text-white/55">Espaço reservado para o anúncio</div>
              )}
            </div>
            <Button className="mt-5 w-full" disabled={adCountdown > 0} onClick={continueAfterAd}>
              {adCountdown > 0 ? `Continue em ${adCountdown}s` : "Continuar leitura"}
            </Button>
          </div>
        </div>
      ) : null}

      {onboardingVisible ? (
        <div
          className="absolute inset-0 z-[90] flex items-center justify-center bg-black/95 p-4 text-white"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reader-onboarding-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-900 p-5 shadow-2xl sm:p-7">
            <div className="mb-6 flex gap-2" aria-label={`Etapa ${onboardingStep + 1} de 4`}>
              {[0, 1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-1.5 flex-1 rounded-full ${step <= onboardingStep ? "bg-primary" : "bg-white/15"}`}
                />
              ))}
            </div>

            {onboardingStep === 0 ? (
              <TutorialStep icon={<BookOpen className="size-8" />} title="Leitura em tela cheia">
                O leitor usa toda a tela para manter o foco na página. A posição é salva
                automaticamente para você continuar depois.
              </TutorialStep>
            ) : null}
            {onboardingStep === 1 ? (
              <TutorialStep
                icon={<MoveHorizontal className="size-8" />}
                title="Deslize para trocar"
              >
                No modo por páginas, mangás seguem da direita para a esquerda. HQs, gibis e livros
                seguem sempre da esquerda para a direita.
              </TutorialStep>
            ) : null}
            {onboardingStep === 2 ? (
              <TutorialStep icon={<MoveDown className="size-8" />} title="Leitura vertical">
                Mangás, HQs, gibis e livros também podem ser lidos em scroll vertical contínuo.
                O menu se recolhe ao rolar. Toque na leitura para abrir ou ocultar os controles.
              </TutorialStep>
            ) : null}
            {onboardingStep === 3 ? (
              <TutorialStep icon={<Settings2 className="size-8" />} title="Leitor do seu jeito">
                Troque entre Páginas e Scroll dentro do próprio leitor. A direção horizontal é
                definida automaticamente pelo tipo da obra. Segure a tela para ver a prévia e
                escolher outra página sem perder sua posição até confirmar.
              </TutorialStep>
            ) : null}

            <div className="mt-7 flex gap-3">
              {onboardingStep > 0 ? (
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => setOnboardingStep((step) => step - 1)}
                >
                  Voltar
                </Button>
              ) : null}
              <Button
                className="flex-1"
                onClick={() => {
                  if (onboardingStep < 3) setOnboardingStep((step) => step + 1);
                  else void finishOnboarding();
                }}
              >
                {onboardingStep < 3 ? "Próximo" : "Começar leitura"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={bookmarkDialogOpen} onOpenChange={setBookmarkDialogOpen}>
        <DialogContent className="w-[calc(100%_-_1rem)] max-w-sm rounded-2xl p-4 sm:w-full sm:rounded-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Salvar página {index + 1}</DialogTitle>
            <DialogDescription>Escolha uma coleção ou crie uma nova.</DialogDescription>
          </DialogHeader>
          {bookmarkCollections.length ? (
            <div className="grid gap-2">
              {bookmarkCollections.map((collection) => (
                <Button
                  key={collection.id}
                  variant="outline"
                  disabled={savingBookmark}
                  onClick={() => saveBookmark(collection.id)}
                >
                  <Bookmark className="size-4" /> {collection.name}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={newCollectionName}
              maxLength={60}
              placeholder="Nome da coleção"
              onChange={(event) => setNewCollectionName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createCollectionAndSave();
              }}
            />
            <Button
              size="icon"
              disabled={savingBookmark || !newCollectionName.trim()}
              onClick={createCollectionAndSave}
              aria-label="Criar coleção e salvar página"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Painel de comentários */}
      {!hideComments && commentsOpen && volume ? (
        <div className="absolute inset-0 z-30 flex justify-end bg-background/70 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Fechar comentários"
            className="flex-1"
            onClick={() => setCommentsOpen(false)}
          />
          <aside className="ink-panel h-full w-full max-w-md overflow-y-auto p-4">
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => setCommentsOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <CommentSection
              mangaId={volume.manga_id}
              volumeId={volume.id}
              title={`Comentários — ${unitLabel(volume.unit_kind)}: ${volume.number}`}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function TutorialStep({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
        {icon}
      </div>
      <h2 id="reader-onboarding-title" className="mt-5 font-display text-2xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-white/65">{children}</p>
    </div>
  );
}
