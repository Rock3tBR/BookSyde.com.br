import { getReaderPreferences, getPersonalLayouts, saveReaderPreferences, savePersonalLayout } from "@/lib/readerPersonalization";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CircleHelp, Maximize2, Minimize2, MoveDown, MoveHorizontal, Settings2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { signReaderSource } from "@/lib/readerAccess";
import { useAuth } from "@/lib/auth";
import { readEpub } from "@/lib/epub";
import { getOfflineEpub, getOfflineVolume } from "@/lib/offlineVolumes";
import { unitLabel } from "@/lib/publication";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { startSystemTutorial } from "@/lib/tutorialEvents";
import { toast } from "sonner";
import { useReadingTimeTracker } from "@/hooks/useReadingTimeTracker";
import { canUseRealFullscreen } from "@/lib/fullscreen";
import { ReaderPageNavigator } from "@/components/ReaderPageNavigator";
import { MobileBookOpeningLottie } from "@/components/MobileBookOpeningLottie";

type ReadingMode = "paged" | "vertical";
type ReadingDirection = "manga" | "book";

export type ReaderPalette = "white" | "black" | "sepia" | "paper";

export const READER_PALETTES: Record<
  ReaderPalette,
  { label: string; bg: string; fg: string; rule: string }
> = {
  white: { label: "Branco", bg: "#ffffff", fg: "#16181c", rule: "#dcdcdc" },
  black: { label: "Preto", bg: "#0b0b0b", fg: "#d7d3cc", rule: "#2a2a2a" },
  sepia: { label: "Sépia", bg: "#f2e6d2", fg: "#4a3826", rule: "#d9c8ad" },
  paper: { label: "Página amarela", bg: "#f7e8b8", fg: "#3a301c", rule: "#dfc98d" },
};

// Runs inside the sandboxed EPUB frame: its pointer events do not bubble to React.
function gestureScript(vertical = false) {
  return [
    "var sx = 0, sy = 0, tracking = false, moved = false, held = false, holdTimer;",
    "function sendGesture(type) { parent.postMessage({ source: 'epub', type: type }, '*'); }",
    "function cancelGesture() { clearTimeout(holdTimer); tracking = false; }",
    "window.addEventListener('pointerdown', function (event) {",
    "  if (!event.isPrimary) { cancelGesture(); return; }",
    "  if (event.button !== 0) return;",
    "  sx = event.clientX; sy = event.clientY; tracking = true; moved = false; held = false;",
    "  clearTimeout(holdTimer);",
    "  holdTimer = setTimeout(function () { if (tracking && !moved) { held = true; sendGesture('long-press'); } }, 550);",
    "});",
    "window.addEventListener('pointermove', function (event) {",
    "  if (!tracking) return;",
    "  if (Math.abs(event.clientX - sx) > 12 || Math.abs(event.clientY - sy) > 12) { moved = true; clearTimeout(holdTimer); }",
    "});",
    "window.addEventListener('pointerup', function (event) {",
    "  if (!tracking) return; cancelGesture();",
    "  if (held) return;",
    "  var dx = event.clientX - sx, dy = event.clientY - sy;",
    ...(!vertical ? ["  if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) { sendGesture(dx > 0 ? 'swipe-right' : 'swipe-left'); return; }"] : []),
    "  if (!moved && Math.abs(dx) < 12 && Math.abs(dy) < 12) sendGesture('tap');",
    "});",
    "window.addEventListener('pointercancel', cancelGesture);",
    "window.addEventListener('blur', cancelGesture);",
    "window.addEventListener('pagehide', cancelGesture);",
    "window.addEventListener('contextmenu', function (event) { if (tracking || held) event.preventDefault(); });",
    "window.addEventListener('scroll', function () { cancelGesture();" + (vertical ? " sendGesture('scroll');" : "") + " }, { passive: true });",
  ].join("\n");
}
const swipeScript = gestureScript();

const themeScript = [
  "window.addEventListener('message', function (event) {",
  "  var data = event.data || {};",
  "  if (data.type === 'theme') {",
  "    document.documentElement.style.background = data.bg;",
  "    document.body.style.background = data.bg;",
  "    document.body.style.color = data.fg;",
  "    document.body.style.setProperty('--rule', data.rule);",
  "  }",
  "});",
].join("\n");

/**
 * Livro paginado em colunas do tamanho do viewport. A progressão visual é
 * sempre da esquerda para a direita para livros, HQs e gibis.
 */
function buildTextDocument(html: string, fontSize: number, palette: ReaderPalette) {
  const colors = READER_PALETTES[palette];
  const script = [
    "var content = document.getElementById('content');",
    "var page = 0;",
    "var total = 1;",
    "var step = 1;",
    "var hasExternalPosition = false;",
    "function layout(keepRatio) {",
    "  var ratio = (keepRatio || hasExternalPosition) && total > 1 ? page / (total - 1) : 0;",
    "  var padX = Math.max(20, Math.round(window.innerWidth * 0.055));",
    "  var padY = Math.max(22, Math.round(window.innerHeight * 0.045));",
    "  var width = window.innerWidth - padX * 2;",
    "  var height = window.innerHeight - padY * 2;",
    "  var gap = Math.max(32, Math.round(padX * 1.5));",
    "  content.style.padding = padY + 'px ' + padX + 'px';",
    "  content.style.height = height + 'px';",
    "  content.style.columnWidth = width + 'px';",
    "  content.style.columnGap = gap + 'px';",
    "  step = width + gap;",
    "  total = Math.max(1, Math.round(content.scrollWidth / step));",
    "  page = Math.min(total - 1, Math.round(ratio * Math.max(total - 1, 0)));",
    "  apply();",
    "  parent.postMessage({ source: 'epub', type: 'layout', total: total, page: page }, '*');",
    "}",
    "function apply() { content.style.transform = 'translateX(' + (-page * step) + 'px)'; }",
    swipeScript,
    "window.addEventListener('message', function (event) {",
    "  var data = event.data || {};",
    "  if (data.type === 'goto') {",
    "    hasExternalPosition = true;",
    "    page = Math.max(0, Math.min(total - 1, Number(data.page) || 0));",
    "    apply();",
    "    parent.postMessage({ source: 'epub', type: 'page', page: page, total: total }, '*');",
    "  }",
    "  if (data.type === 'font') {",
    "    document.body.style.fontSize = data.size + 'px';",
    "    layout(true);",
    "  }",
    "});",
    themeScript,
    "window.addEventListener('resize', function () { layout(true); });",
    "if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(false); });",
    "else layout(false);",
    "window.addEventListener('load', function () { layout(true); });",
  ].join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
  * { box-sizing: border-box; }
  body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; touch-action: none; }
  html { background: ${colors.bg}; }
  body {
    --rule: ${colors.rule};
    background: ${colors.bg};
    color: ${colors.fg};
    font-family: Georgia, "Times New Roman", serif;
    font-size: ${fontSize}px;
    line-height: 1.62;
  }
  #content {
    height: 100%;
    column-fill: auto;
    text-align: justify;
    hyphens: auto;
    -webkit-hyphens: auto;
    transition: transform .11s cubic-bezier(.22,.61,.36,1);
    will-change: transform;
  }
  p { margin: 0 0 .9em; text-indent: 1.35em; orphans: 2; widows: 2; }
  p:first-of-type { text-indent: 0; }
  h1, h2, h3 { font-weight: 600; line-height: 1.25; margin: 0 0 .8em; text-align: left; break-after: avoid; }
  img, svg { max-width: 100%; height: auto; display: block; margin: 1em auto; break-inside: avoid; }
  blockquote { margin: 0 0 1em 1.2em; font-style: italic; }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 1.4em auto; width: 40%; }
</style>
</head>
<body>
<div id="content">${html}</div>
<script>${script}</script>
</body>
</html>`;
}

function buildVerticalTextDocument(html: string, fontSize: number, palette: ReaderPalette) {
  const colors = READER_PALETTES[palette];
  const script = [
    "var ticking = false;",
    "var total = 1;",
    "function metrics() {",
    "  var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);",
    "  total = Math.max(1, Math.ceil(document.documentElement.scrollHeight / Math.max(window.innerHeight, 1)));",
    "  var ratio = max > 0 ? window.scrollY / max : 0;",
    "  var page = Math.max(0, Math.min(total - 1, Math.round(ratio * Math.max(total - 1, 0))));",
    "  parent.postMessage({ source: 'epub', type: 'layout', total: total, page: page }, '*');",
    "}",
    "window.addEventListener('scroll', function () {",
    "  if (ticking) return; ticking = true;",
    "  requestAnimationFrame(function () { ticking = false; metrics(); });",
    "}, { passive: true });",
    "window.addEventListener('message', function (event) {",
    "  var data = event.data || {};",
    "  if (data.type === 'goto') {",
    "    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);",
    "    var target = Math.max(0, Math.min(total - 1, Number(data.page) || 0));",
    "    var ratio = total > 1 ? target / (total - 1) : 0;",
    "    window.scrollTo(0, max * ratio); metrics();",
    "  }",
    "  if (data.type === 'font') { document.body.style.fontSize = data.size + 'px'; metrics(); }",
    "});",
    themeScript,
    "window.addEventListener('resize', metrics);",
    gestureScript(true),
    "window.addEventListener('load', metrics);",
    "if (document.fonts && document.fonts.ready) document.fonts.ready.then(metrics);",
  ].join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
  * { box-sizing: border-box; }
  body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
  html { background: ${colors.bg}; }
  body {
    --rule: ${colors.rule};
    margin: 0 auto;
    min-height: 100%;
    max-width: 820px;
    padding: max(28px, env(safe-area-inset-top)) clamp(22px, 6vw, 58px) max(52px, env(safe-area-inset-bottom));
    background: ${colors.bg};
    color: ${colors.fg};
    font-family: Georgia, "Times New Roman", serif;
    font-size: ${fontSize}px;
    line-height: 1.68;
  }
  #content { text-align: justify; hyphens: auto; -webkit-hyphens: auto; }
  p { margin: 0 0 .95em; text-indent: 1.35em; }
  p:first-of-type { text-indent: 0; }
  h1, h2, h3 { font-weight: 600; line-height: 1.25; margin: 1.4em 0 .8em; text-align: left; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  img, svg { max-width: 100%; height: auto; display: block; margin: 1.2em auto; }
  blockquote { margin: 0 0 1em 1.2em; font-style: italic; }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 2em auto; width: 40%; }
</style>
</head>
<body>
<div id="content">${html}</div>
<script>${script}</script>
</body>
</html>`;
}

function buildImageDocument(html: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
  * { box-sizing: border-box; }
  body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #050505; touch-action: none; }
  .epub-manga-page { height: 100%; display: flex; align-items: center; justify-content: center; }
  .epub-manga-page img { max-width: 100%; max-height: 100%; width: auto; height: auto; display: block; }
</style>
</head>
<body>${html}<script>${swipeScript}</script></body>
</html>`;
}

function buildVerticalImageDocument(sections: Array<{ html: string }>) {
  const pages = sections
    .map((section, index) => `<section class="reader-page" data-page="${index}">${section.html}</section>`)
    .join("\n");
  const script = [
    "var items = Array.prototype.slice.call(document.querySelectorAll('[data-page]'));",
    "var current = 0;",
    "var observer = new IntersectionObserver(function (entries) {",
    "  var visible = entries.filter(function (entry) { return entry.isIntersecting; }).sort(function (a,b) { return b.intersectionRatio - a.intersectionRatio; })[0];",
    "  if (!visible) return; current = Number(visible.target.getAttribute('data-page')) || 0;",
    "  parent.postMessage({ source: 'epub', type: 'page', page: current, total: items.length }, '*');",
    "}, { threshold: [0.35, 0.55, 0.75] });",
    "items.forEach(function (item) { observer.observe(item); });",
    "window.addEventListener('message', function (event) {",
    "  var data = event.data || {};",
    "  if (data.type === 'goto') {",
    "    var target = Math.max(0, Math.min(items.length - 1, Number(data.page) || 0));",
    "    if (items[target]) items[target].scrollIntoView({ block: 'start' });",
    "  }",
    "});",
    gestureScript(true),
    "window.addEventListener('load', function () { parent.postMessage({ source: 'epub', type: 'layout', page: current, total: items.length }, '*'); });",
  ].join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
  * { box-sizing: border-box; }
  body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
  html { background: #050505; }
  body { margin: 0; background: #050505; }
  .reader-page { min-height: 70vh; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid rgba(255,255,255,.06); }
  .epub-manga-page { width: 100%; display: flex; align-items: center; justify-content: center; }
  .epub-manga-page img { display: block; width: 100%; max-width: 1100px; height: auto; margin: 0 auto; }
</style>
</head>
<body>${pages}<script>${script}</script></body>
</html>`;
}

export function EpubReader({ volumeId, onClose }: { volumeId: string; onClose?: () => void }) {
  const { user } = useAuth();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const readerRef = useRef<HTMLElement>(null);
  const restoreTargetRef = useRef(0);
  const restoreRatioRef = useRef<number | null>(null);
  const restorePendingRef = useRef(true);
  const progressHydratedRef = useRef(false);
  const completedAtRef = useRef<string | null>(null);
  const readingModeRef = useRef<ReadingMode>("paged");
  const previousReadingModeRef = useRef<ReadingMode>("paged");

  const [index, setIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [fontSize, setFontSize] = useState(20);
  const [palette, setPalette] = useState<ReaderPalette>("paper");
  const [ready, setReady] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [readingMode, setReadingMode] = useState<ReadingMode>("paged");
  const [preferencesOwner, setPreferencesOwner] = useState<string | null>(null);
  const preferencesReady = preferencesOwner === (user?.id ?? "guest");
  const hasLayout = useRef(false);
  const [positionRestored, setPositionRestored] = useState(false);
  readingModeRef.current = readingMode;

  // Fonte e cor de fundo são aplicadas por mensagem para não recarregar
  // o documento (o leitor perderia a página atual).
  const fontRef = useRef(fontSize);
  const paletteRef = useRef(palette);
  fontRef.current = fontSize;
  paletteRef.current = palette;

  useReadingTimeTracker({
    volumeId,
    userId: user?.id ?? null,
    enabled: !!user && navigator.onLine,
  });

  const { data, error, isLoading } = useQuery({
    queryKey: ["epub-content", volumeId, user?.id],
    networkMode: "always",
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const savedVolume = getOfflineVolume(volumeId);
      const offline = await getOfflineEpub(volumeId);
      if (savedVolume && offline) {
        return {
          volume: {
            number: savedVolume.volumeNumber,
            unit_kind: "volume",
            mangas: { title: savedVolume.mangaTitle, slug: savedVolume.mangaSlug, work_type: savedVolume.workType ?? "book" },
          },
          book: await readEpub(offline),
        };
      }
      if (!navigator.onLine) {
        throw new Error("O download deste livro está incompleto. Conecte-se e baixe o livro novamente.");
      }
      const volumeRequest = supabase
        .from("volumes")
        .select("number,unit_kind,mangas(title,slug,work_type)")
        .eq("id", volumeId)
        .abortSignal(signal)
        .single();

      const [volume, book] = await Promise.all([
        volumeRequest,
        (async () => {
          const sourceUrl = await signReaderSource(volumeId);
          const source = await fetch(sourceUrl, { signal });
          if (!source.ok) throw new Error("Não foi possível baixar o ePub.");
          return readEpub(await source.blob());
        })(),
      ]);
      if (volume.error) throw volume.error;
      return { volume: volume.data, book };
    },
  });

  const isText = data?.book.kind === "text";
  const workType = data?.volume.mangas?.work_type ?? "book";
  const readingDirection: ReadingDirection = workType === "manga" ? "manga" : "book";

  useEffect(() => {
    const saved = getReaderPreferences(user?.id);
    setReadingMode(saved.readingMode);
    setPalette(saved.palette);
    setFontSize(saved.fontSize);
    setPreferencesOwner(user?.id ?? "guest");
  }, [user?.id]);

  useEffect(() => {
    if (!preferencesReady) return;
    saveReaderPreferences(user?.id, { readingMode, palette, fontSize });
  }, [user?.id, preferencesReady, readingMode, palette, fontSize]);

  useEffect(() => {
    if (!preferencesReady) return;
    if (readingMode === "vertical") setChromeVisible(false);
  }, [preferencesReady, readingMode]);

  useEffect(() => {
    if (!preferencesReady) return;
    post({ type: "theme", ...READER_PALETTES[palette] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    post({ type: "font", size: fontSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize, preferencesReady]);

  const currentImageHtml =
    data?.book.kind === "images" && readingMode === "paged"
      ? data.book.sections[index]?.html ?? ""
      : "";

  const document_ = useMemo(() => {
    if (!data || !preferencesReady) return "";

    if (readingMode === "vertical") {
      if (data.book.kind === "text") {
        return buildVerticalTextDocument(
          data.book.sections.map((section) => section.html).join("\n<hr>\n"),
          fontRef.current,
          paletteRef.current,
        );
      }
      return buildVerticalImageDocument(data.book.sections);
    }

    if (data.book.kind === "text") {
      return buildTextDocument(
        data.book.sections.map((section) => section.html).join("\n<hr>\n"),
        fontRef.current,
        paletteRef.current,
      );
    }

    return buildImageDocument(currentImageHtml);
  }, [currentImageHtml, data, readingMode, preferencesReady]);

  const post = useCallback((message: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;

      const payload = event.data as {
        source?: string;
        type?: string;
        total?: number;
        page?: number;
      };
      if (payload?.source !== "epub") return;

      if (payload.type === "scroll") {
        setChromeVisible(false);
        return;
      }
      if (payload.type === "long-press") {
        if (!restorePendingRef.current) {
          setChromeVisible(false);
          setNavigatorOpen(true);
        }
        return;
      }
      if (payload.type === "tap") {
        if (!restorePendingRef.current) {
          setChromeVisible((visible) => !visible);
        }
        return;
      }
      if (payload.type === "swipe-left" || payload.type === "swipe-right") {
        if (restorePendingRef.current || readingModeRef.current !== "paged") return;
        const movingRight = payload.type === "swipe-right";
        const forward = readingDirection === "manga" ? movingRight : !movingRight;
        setIndex((current) => Math.max(0, current + (forward ? 1 : -1)));
        setChromeVisible(false);
        return;
      }

      const reportedTotal =
        typeof payload.total === "number" ? Math.max(1, payload.total) : null;
      if (reportedTotal !== null && Number.isSafeInteger(reportedTotal)) { hasLayout.current = true; setTotalPages(reportedTotal); }

      if (typeof payload.page !== "number") return;
      const maxIndex = Math.max((reportedTotal ?? totalPages) - 1, 0);
      const reportedPage = Math.max(0, Math.min(maxIndex, payload.page));

      // Durante a abertura do EPUB, o iframe sempre nasce na página 0 e só
      // depois calcula a quantidade real de páginas. Não deixe esse primeiro
      // evento apagar o progresso já salvo do usuário.
      if (restorePendingRef.current && progressHydratedRef.current) {
        if (restoreRatioRef.current !== null) {
          restoreTargetRef.current = Math.round(restoreRatioRef.current * maxIndex);
          restoreRatioRef.current = null;
        }
        const target = Math.max(0, Math.min(maxIndex, restoreTargetRef.current));
        if (reportedPage === target) {
          restorePendingRef.current = false;
          setIndex(target);
          setPositionRestored(true);
        } else {
          post({ type: "goto", page: target });
        }
        return;
      }

      setIndex(reportedPage);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [post, readingDirection, totalPages]);

  useEffect(() => {
    let active = true;
    hasLayout.current = false;
    setReady(false);
    setPositionRestored(false);
    restorePendingRef.current = true;
    progressHydratedRef.current = false;
    if (!data || !preferencesReady) return;

    void (async () => {
      const personal = getPersonalLayouts(user?.id)[volumeId];
      const localValue = personal ? String(personal.pageIndex) : user ? null : window.localStorage.getItem(`mangaka-page-${volumeId}`);
      const localUpdatedAt = personal?.updatedAt ?? (user ? 0 : Number(window.localStorage.getItem(`mangaka-page-updated-${volumeId}`)));
      let saved = localValue === null ? 0 : Number(localValue);
      let usePersonalPosition = !!personal;
      completedAtRef.current = user ? null : window.localStorage.getItem(`mangaka-completed-${volumeId}`);
      if (!Number.isFinite(saved) || saved < 0) saved = 0;

      if (user && navigator.onLine) {
        const progress = await supabase
          .from("reading_progress")
          .select("page_index, updated_at, completed_at")
          .eq("user_id", user.id)
          .eq("volume_id", volumeId)
          .maybeSingle();

        if (progress.error) {
          console.error("Não foi possível carregar o progresso do EPUB", progress.error);
        } else if (typeof progress.data?.page_index === "number") {
          completedAtRef.current = progress.data.completed_at ?? completedAtRef.current;
          const remoteUpdatedAt = progress.data.updated_at
            ? new Date(progress.data.updated_at).getTime()
            : 0;
          const hasNewerLocalProgress =
            Number.isFinite(localUpdatedAt) &&
            localUpdatedAt > 0 &&
            localUpdatedAt > remoteUpdatedAt;

          if (!hasNewerLocalProgress) { saved = progress.data.page_index; usePersonalPosition = false; }
        }
      }

      if (!active) return;

      const restored = Math.max(0, Math.floor(saved));
      restoreTargetRef.current = restored;
      restoreRatioRef.current = usePersonalPosition && personal ? personal.pageIndex / Math.max(1, personal.pageCount - 1) : null;
      progressHydratedRef.current = true;
      setIndex(restored);

      // Em EPUBs compostos por imagens no modo paginado, o índice do React já
      // escolhe diretamente a página renderizada. Texto e modo vertical precisam
      // aguardar o iframe confirmar que foi reposicionado.
      const needsIframeRestore =
        data.book.kind === "text" || readingModeRef.current === "vertical";
      restorePendingRef.current = needsIframeRestore;
      setPositionRestored(!needsIframeRestore);
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [data, preferencesReady, user, volumeId]);

  useEffect(() => {
    if (!ready || !data) {
      previousReadingModeRef.current = readingMode;
      return;
    }
    if (previousReadingModeRef.current === readingMode) return;

    previousReadingModeRef.current = readingMode;
    restoreTargetRef.current = index;
    progressHydratedRef.current = true;

    const needsIframeRestore = data.book.kind === "text" || readingMode === "vertical";
    restorePendingRef.current = needsIframeRestore;
    setPositionRestored(!needsIframeRestore);
  }, [data, index, readingMode, ready]);

  useEffect(() => {
    if (!ready || !data) return;
    const count = data.book.kind === "images" && readingMode === "paged" ? data.book.sections.length : totalPages;
    if (count > 0 && index >= count) setIndex(count - 1);
  }, [data, index, readingMode, ready, totalPages]);

  useEffect(() => {
    if (
      !ready ||
      !positionRestored ||
      !data ||
      readingMode !== "paged" ||
      data.book.kind !== "text"
    )
      return;
    post({ type: "goto", page: index });
  }, [data, index, positionRestored, post, readingMode, ready]);

  useEffect(() => {
    if (!ready || !positionRestored || !data || readingMode !== "vertical") return;
    const frame = window.requestAnimationFrame(() => post({ type: "goto", page: index }));
    return () => window.cancelAnimationFrame(frame);
    // Depois da restauração inicial, mudanças explícitas de posição podem navegar normalmente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, positionRestored, post, readingMode, ready, volumeId]);

  useEffect(() => {
    if (!ready || !positionRestored) return;

    window.localStorage.setItem(`mangaka-page-${volumeId}`, String(index));
    window.localStorage.setItem(`mangaka-page-updated-${volumeId}`, String(Date.now()));

    if (user && navigator.onLine) {
      void supabase
        .from("reading_progress")
        .upsert(
          {
            user_id: user.id,
            volume_id: volumeId,
            page_index: index,
            completed_at: completedAtRef.current,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,volume_id" },
        )
        .then(({ error: saveError }) => {
          if (saveError) {
            console.error("Não foi possível sincronizar o progresso do EPUB", saveError);
            toast.error("Não foi possível sincronizar seu progresso.");
          }
        });
    }
  }, [index, positionRestored, ready, user, volumeId]);

  useEffect(() => {
    if (!preferencesReady || !ready || !positionRestored || !data || !hasLayout.current) return;
    const count = data.book.kind === "images" && readingMode === "paged" ? data.book.sections.length : totalPages;
    savePersonalLayout(user?.id, volumeId, count, index);
  }, [preferencesReady, ready, positionRestored, data, readingMode, totalPages, index, user?.id, volumeId]);

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

    const root = (readerRef.current ?? document.documentElement) as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };

    if (document.fullscreenElement) {
      await exitFullscreen();
      return;
    }

    try {
      if (root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: "hide" });
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      } else if (root.msRequestFullscreen) {
        await root.msRequestFullscreen();
      } else {
        return;
      }
      setImmersiveMode(true);
      setChromeVisible(false);
    } catch {
      // Sem fallback visual: se não houver fullscreen real, o botão não deve fingir que há.
    }
  }, [exitFullscreen]);

  useEffect(() => {
    setFullscreenAvailable(canUseRealFullscreen());
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) setImmersiveMode(false);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  if (isLoading) return (
    <>
      <MobileBookOpeningLottie />
      <p className="hidden p-8 md:block">Abrindo ePub…</p>
    </>
  );
  if (error) return <div role="alert" className="p-8">{error.message}</div>;
  if (!data || !ready) return (
    <>
      <MobileBookOpeningLottie />
      <p className="hidden p-8 md:block">Restaurando leitura…</p>
    </>
  );

  const { volume, book } = data;
  const count = readingMode === "vertical" || isText ? totalPages : book.sections.length;
  const current = Math.max(0, Math.min(index, Math.max(count - 1, 0)));
  const isLastPage = current >= count - 1;
  const goTo = (page: number) => {
    const target = Math.max(0, Math.min(count - 1, page));
    setIndex(target);
    if (readingMode === "vertical") post({ type: "goto", page: target });
  };

  return (
    <main
      ref={readerRef}
      className={`fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden overscroll-none bg-[#050505] ${
        immersiveMode || isFullscreen ? "reader-immersive" : ""
      }`}
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
              <p className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">{volume.mangas?.title ?? "Leitura"}</p>
              <p className="mt-0.5 truncate text-[11px] tabular-nums text-white/55">
                {unitLabel(volume.unit_kind)} {volume.number} <span aria-hidden="true">·</span> Página {current + 1} de {count}
              </p>
            </div>
            {onClose ? (
              <Button variant="ghost" size="icon" className="size-10 shrink-0 rounded-xl border border-white/10 text-white/80 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Fechar leitura" title="Voltar às informações da obra">
                <X className="size-[18px]" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="size-10 shrink-0 rounded-xl border border-white/10 text-white/80 hover:bg-white/10 hover:text-white" asChild>
                <Link to="/manga/$slug" params={{ slug: volume.mangas!.slug }} search={{ invite: "" }} aria-label="Fechar leitura" title="Voltar às informações da obra">
                  <X className="size-[18px]" />
                </Link>
              </Button>
            )}
          </div>

          <div className="mx-auto mt-3 flex max-w-4xl items-center justify-between gap-2 border-t border-white/10 pt-3">
            <div role="group" aria-label="Modo de leitura" className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setReadingMode("paged")}
                aria-pressed={readingMode === "paged"}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors sm:px-3 ${readingMode === "paged" ? "bg-white/15 text-white shadow-sm" : "text-white/55 hover:bg-white/10 hover:text-white"}`}
              >
                <MoveHorizontal className="size-3.5" /> Páginas
              </button>
              <button
                type="button"
                onClick={() => { setReadingMode("vertical"); setChromeVisible(false); }}
                aria-pressed={readingMode === "vertical"}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors sm:px-3 ${readingMode === "vertical" ? "bg-white/15 text-white shadow-sm" : "text-white/55 hover:bg-white/10 hover:text-white"}`}
              >
                <MoveDown className="size-3.5" /> Scroll
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="icon" className="size-10 rounded-xl text-white/75 hover:bg-white/10 hover:text-white" aria-label="Navegar pelas páginas" title="Navegar pelas páginas — segure a tela" onClick={() => { setChromeVisible(false); setNavigatorOpen(true); }}>
                <BookOpen className="size-[18px]" />
              </Button>
              {isText ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-10 rounded-xl border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white" aria-label="Aparência da leitura" title="Aparência da leitura">
                      <Settings2 className="size-[18px]" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" sideOffset={12} className="z-[70] w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border-white/15 bg-[#202020] p-4 text-white shadow-2xl">
                    <p className="text-sm font-semibold">Aparência da leitura</p>
                    <p className="mt-1 text-xs text-white/55">Ajuste o texto sem perder sua página.</p>
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white/70">Tamanho do texto</span>
                      <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
                        <Button variant="ghost" size="icon" className="size-9 rounded-lg text-white hover:bg-white/10 hover:text-white" disabled={fontSize <= 14} onClick={() => setFontSize((value) => Math.max(14, value - 2))} aria-label="Diminuir fonte">A−</Button>
                        <span className="w-9 text-center text-xs font-semibold tabular-nums" aria-live="polite">{fontSize}px</span>
                        <Button variant="ghost" size="icon" className="size-9 rounded-lg text-white hover:bg-white/10 hover:text-white" disabled={fontSize >= 32} onClick={() => setFontSize((value) => Math.min(32, value + 2))} aria-label="Aumentar fonte">A+</Button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-white/60">Estas preferências valem para todos os seus livros neste navegador.</p>
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <p className="mb-3 text-xs font-medium text-white/70">Cor das páginas</p>
                      <div role="group" aria-label="Cor das páginas" className="grid grid-cols-4 gap-2">
                        {(Object.keys(READER_PALETTES) as ReaderPalette[]).map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-label={`Fundo ${READER_PALETTES[option].label}`}
                            aria-pressed={palette === option}
                            onClick={() => setPalette(option)}
                            className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border p-2 text-[10px] transition-colors ${palette === option ? "border-white/65 bg-white/10 text-white" : "border-white/10 text-white/55 hover:border-white/30 hover:text-white"}`}
                          >
                            <span className="size-7 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: READER_PALETTES[option].bg }} />
                            <span className="truncate">{READER_PALETTES[option].label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}
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
              <Button variant="ghost" size="icon" className="size-10 rounded-xl text-white/65 hover:bg-white/10 hover:text-white" onClick={() => startSystemTutorial("reader")} aria-label="Ajuda com o leitor" title="Ajuda com o leitor">
                <CircleHelp className="size-[18px]" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        data-tour="reader-page"
        className={`h-full w-full ${readingMode === "vertical" ? "touch-auto" : "touch-none"}`}
      >
        <iframe
          ref={frameRef}
          key={readingMode === "vertical" ? `vertical-${book.kind}` : isText ? "text" : `image-${current}`}
          title={`Página ${current + 1}`}
          sandbox="allow-scripts"
          srcDoc={document_}
          onLoad={() => {
            if (isText) {
              post({ type: "theme", ...READER_PALETTES[palette] });
              post({ type: "font", size: fontSize });
            }
            if ((isText || readingMode === "vertical") && !restorePendingRef.current) {
              post({ type: "goto", page: current });
            }
          }}
          className="h-full w-full border-0"
          style={{ background: isText ? READER_PALETTES[palette].bg : "#050505" }}
        />
      </div>

      {chromeVisible && readingMode === "paged" ? (
        <div data-tour="reader-navigation" className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8">
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-black/75 p-2 text-white shadow-2xl backdrop-blur-xl">
            <Button variant="ghost" className="flex-1 text-white hover:bg-white/10 hover:text-white" disabled={current === 0} onClick={() => goTo(current - 1)}>
              Anterior
            </Button>
            <span className="min-w-20 text-center text-xs font-medium text-white/70">{current + 1}/{count}</span>
            {!isLastPage ? (
              <Button variant="ghost" className="flex-1 text-white hover:bg-white/10 hover:text-white" onClick={() => goTo(current + 1)}>
                Próxima
              </Button>
            ) : onClose ? (
              <Button variant="ghost" className="flex-1 text-white hover:bg-white/10 hover:text-white" onClick={onClose}>Ver obra</Button>
            ) : (
              <Button variant="ghost" className="flex-1 text-white hover:bg-white/10 hover:text-white" asChild>
                <Link to="/manga/$slug" params={{ slug: volume.mangas!.slug }} search={{ invite: "" }}>Ver obra</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {navigatorOpen ? (
        <ReaderPageNavigator
          current={current}
          count={count}
          container={readerRef.current}
          onClose={() => setNavigatorOpen(false)}
          onNavigate={(page) => { goTo(page); setChromeVisible(false); }}
          renderPreview={(page) => (
            <EpubPagePreview
              documentHtml={book.kind === "images" ? buildImageDocument(book.sections[page]?.html ?? "") : document_}
              page={book.kind === "images" ? 0 : page}
              width={frameRef.current?.clientWidth ?? 390}
              height={frameRef.current?.clientHeight ?? 800}
              fontSize={fontSize}
              palette={palette}
            />
          )}
        />
      ) : null}

      {readingMode === "vertical" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-white/10">
          <div className="h-full bg-primary transition-all" style={{ width: `${((current + 1) / Math.max(count, 1)) * 100}%` }} />
        </div>
      ) : null}
    </main>
  );
}

// Render at the reader's actual dimensions, then scale visually. This preserves
// the real pagination; the preview frame never updates the reader's progress.
function EpubPagePreview({ documentHtml, page, width, height, fontSize, palette }: {
  documentHtml: string; page: number; width: number; height: number; fontSize: number; palette: ReaderPalette;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const scale = Math.min(180 / Math.max(width, 1), 220 / Math.max(height, 1));
  const sync = useCallback(() => {
    const target = frame.current?.contentWindow;
    target?.postMessage({ type: "theme", ...READER_PALETTES[palette] }, "*");
    target?.postMessage({ type: "font", size: fontSize }, "*");
    target?.postMessage({ type: "goto", page }, "*");
  }, [fontSize, page, palette]);
  useEffect(sync, [sync]);
  return (
    <div aria-hidden="true" style={{ width: width * scale, height: height * scale, overflow: "hidden" }}>
      <iframe ref={frame} title="Prévia de leitura" tabIndex={-1} sandbox="allow-scripts" srcDoc={documentHtml} onLoad={sync}
        style={{ width, height, border: 0, pointerEvents: "none", transform: `scale(${scale})`, transformOrigin: "top left" }} />
    </div>
  );
}
