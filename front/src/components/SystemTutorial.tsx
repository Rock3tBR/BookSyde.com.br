import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleHelp,
  Download,
  FileUp,
  Library,
  PackageCheck,
  ShoppingBag,
  Store,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

import type { TutorialChapter } from "@/lib/tutorialEvents";
import { ALL_STEPS, CHAPTERS, type TutorialPath, type TutorialPreview, type TutorialStep } from "@/lib/tutorialSteps";

type HighlightRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type TooltipSize = {
  width: number;
  height: number;
};

function emitTutorialComplete() {
  try {
    window.localStorage.setItem("mangaka-system-tutorial-v1", "done");
  } catch {
    // O tutorial continua funcionando mesmo sem armazenamento local.
  }
}

function samePath(current: string, expected?: TutorialPath) {
  if (!expected) return true;
  return current === expected;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTooltipStyle(rect: HighlightRect | null, size: TooltipSize): CSSProperties {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const edge = 12;
  const gap = 18;
  const preferredWidth = Math.min(390, viewportWidth - edge * 2);
  const preferredHeight = Math.min(size.height || 300, viewportHeight - edge * 2);

  if (!rect) {
    return {
      width: preferredWidth,
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      maxHeight: `calc(100vh - ${edge * 2}px)`,
      overflowY: "auto",
    };
  }

  const leftSpace = rect.left - gap - edge;
  const rightSpace = viewportWidth - rect.right - gap - edge;
  const topSpace = rect.top - gap - edge;
  const bottomSpace = viewportHeight - rect.bottom - gap - edge;
  const minimumSideWidth = Math.min(280, preferredWidth);

  // Prioriza os lados. Assim o card não cobre blocos altos ou largos, como nos destaques da Home.
  if (rightSpace >= minimumSideWidth || leftSpace >= minimumSideWidth) {
    const useRight = rightSpace >= leftSpace;
    const available = useRight ? rightSpace : leftSpace;
    const width = Math.min(preferredWidth, available);
    const top = clamp(
      rect.top + rect.height / 2 - preferredHeight / 2,
      edge,
      Math.max(edge, viewportHeight - preferredHeight - edge),
    );

    return useRight
      ? {
          width,
          left: rect.right + gap,
          top,
          maxHeight: `calc(100vh - ${edge * 2}px)`,
          overflowY: "auto",
        }
      : {
          width,
          left: rect.left - gap - width,
          top,
          maxHeight: `calc(100vh - ${edge * 2}px)`,
          overflowY: "auto",
        };
  }

  // Se não couber nas laterais, tenta abaixo ou acima mantendo o card completamente fora do destaque.
  if (bottomSpace >= preferredHeight || topSpace >= preferredHeight) {
    const useBottom = bottomSpace >= topSpace;
    const width = preferredWidth;
    const left = clamp(
      rect.left + rect.width / 2 - width / 2,
      edge,
      Math.max(edge, viewportWidth - width - edge),
    );

    return useBottom
      ? {
          width,
          left,
          top: rect.bottom + gap,
          maxHeight: Math.max(120, bottomSpace),
          overflowY: "auto",
        }
      : {
          width,
          left,
          top: Math.max(edge, rect.top - gap - preferredHeight),
          maxHeight: Math.max(120, topSpace),
          overflowY: "auto",
        };
  }

  // Em telas pequenas pode ser fisicamente impossível deixar um card completo fora do alvo.
  // Nesse caso usamos a maior faixa disponível e limitamos a altura para minimizar a sobreposição.
  const verticalBelow = bottomSpace >= topSpace;
  const width = preferredWidth;
  const left = clamp(
    rect.left + rect.width / 2 - width / 2,
    edge,
    Math.max(edge, viewportWidth - width - edge),
  );
  const availableHeight = Math.max(130, verticalBelow ? bottomSpace : topSpace);

  return verticalBelow
    ? {
        width,
        left,
        top: Math.min(viewportHeight - 130 - edge, rect.bottom + gap),
        maxHeight: availableHeight,
        overflowY: "auto",
      }
    : {
        width,
        left,
        top: edge,
        maxHeight: availableHeight,
        overflowY: "auto",
      };
}

function TutorialPreviewSurface({ kind, visible }: { kind?: TutorialPreview; visible: boolean }) {
  if (!kind) return null;

  const shared = `pointer-events-none fixed z-auto transition-opacity duration-200 ${
    visible ? "opacity-100" : "opacity-0"
  }`;

  if (kind === "offline") {
    return (
      <div
        aria-hidden="true"
        className={`${shared} bottom-8 left-1/2 w-[min(980px,calc(100vw-40px))] -translate-x-1/2`}
      >
        <section
          data-tour-preview="library-offline"
          className="rounded-[1.8rem] border border-primary/30 bg-[#111318]/95 p-4 shadow-[0_28px_90px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Download className="size-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                  Exemplo do tutorial
                </span>
              </div>
              <h2 className="mt-1 font-display text-xl text-white">Disponíveis offline</h2>
              <p className="mt-1 text-xs text-white/50">Conteúdos baixados neste dispositivo</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55">
              3 downloads
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OfflineDemoCard
              title="Black Clover"
              subtitle="Volume 1"
              type="Mangá"
              progress="Pronto para ler"
            />
            <OfflineDemoCard title="Verity" subtitle="Livro" type="EPUB" progress="42% lido" />
            <OfflineDemoCard
              title="Invencível"
              subtitle="Volume 1"
              type="HQ"
              progress="Pronto para ler"
            />
          </div>
        </section>
      </div>
    );
  }

  if (kind === "studio") {
    return (
      <div
        aria-hidden="true"
        className={`${shared} left-1/2 top-[92px] h-[min(72vh,690px)] w-[min(1120px,calc(100vw-44px))] -translate-x-1/2 overflow-hidden rounded-[1.8rem] border border-white/12 bg-[#0f1115]/98 p-5 shadow-[0_30px_100px_rgba(0,0,0,.65)] sm:p-7`}
      >
        <div
          data-tour-preview="studio-header"
          className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
        >
          <p className="text-sm font-medium text-primary">Criação e personalização</p>
          <h1 className="mt-1 font-display text-3xl text-white">Estúdio BookSyde</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/45">
            Crie, organize e publique suas próprias obras dentro do BookSyde.
          </p>
        </div>

        <div
          data-tour-preview="studio-tabs"
          className="mt-4 grid grid-cols-3 gap-1 rounded-[1.1rem] border border-white/10 bg-white/[0.035] p-1"
        >
          <div className="rounded-xl bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground">
            Minhas obras
          </div>
          <div className="rounded-xl px-3 py-3 text-center text-sm text-white/65">Criar obra</div>
          <div className="rounded-xl px-3 py-3 text-center text-sm text-white/65">
            Adicionar conteúdo
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-4">
            <div className="flex items-center gap-3">
              <Library className="size-5 text-primary" />
              <div>
                <h2 className="font-display text-lg text-white">Minhas obras</h2>
                <p className="text-xs text-white/40">
                  Edite capa, informações, preço e publicação.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {["Minha obra", "Nova série", "HQ autoral"].map((title, index) => (
                <div key={title} className="rounded-xl border border-white/8 bg-black/20 p-2">
                  <div className="aspect-[3/4] rounded-lg bg-gradient-to-br from-primary/30 via-white/5 to-black/40" />
                  <p className="mt-2 truncate text-xs font-semibold text-white/75">{title}</p>
                  <p className="text-[10px] text-white/35">{index + 1} conteúdo(s)</p>
                </div>
              ))}
            </div>
          </div>

          <div
            data-tour-preview="studio-content"
            className="rounded-[1.35rem] border border-primary/25 bg-primary/[0.045] p-4"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <FileUp className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg text-white">Adicionar conteúdo</h2>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Selecione uma obra e envie o próximo arquivo.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-black/15 px-4 py-6 text-center">
              <FileUp className="mx-auto size-7 text-primary" />
              <p className="mt-2 text-sm font-semibold text-white/75">
                Arraste o arquivo ou clique para selecionar
              </p>
              <p className="mt-1 text-[11px] text-white/35">PDF • CBR • CBZ • EPUB • MOBI • AZW</p>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
              <span className="text-xs text-white/50">Processamento e capa</span>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                Automático
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${shared} left-1/2 top-[82px] h-[min(76vh,720px)] w-[min(1160px,calc(100vw-44px))] -translate-x-1/2 overflow-hidden rounded-[1.8rem] border border-white/12 bg-[#0f1115]/98 p-5 shadow-[0_30px_100px_rgba(0,0,0,.65)] sm:p-7`}
    >
      <div
        data-tour-preview="seller-header"
        className="rounded-[1.45rem] border border-white/9 bg-white/[0.025] p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
              <Store className="size-5" />
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Central do vendedor
              </span>
              <h1 className="mt-1 font-display text-2xl text-white">Minha loja</h1>
              <p className="mt-1 text-xs text-white/40">
                Vendas, recebimentos, anúncios e apresentação pública.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/45">
            Demonstração
          </span>
        </div>
      </div>

      <div
        data-tour-preview="seller-metrics"
        className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <SellerMetric
          icon={CircleDollarSign}
          label="Faturamento"
          value="R$ 1.284,50"
          note="12 vendas pagas"
        />
        <SellerMetric icon={BookOpen} label="Anúncios ativos" value="8" note="10 no total" />
        <SellerMetric
          icon={ShoppingBag}
          label="Pedidos em aberto"
          value="2"
          note="Aguardando pagamento"
        />
        <SellerMetric icon={PackageCheck} label="Entregas" value="10" note="Confirmadas" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div
          data-tour-preview="seller-payments"
          className="rounded-[1.35rem] border border-primary/25 bg-primary/[0.045] p-4"
        >
          <div className="flex items-center gap-3">
            <WalletCards className="size-5 text-primary" />
            <div>
              <h2 className="font-display text-lg text-white">Meus recebimentos</h2>
              <p className="text-xs text-white/40">Pessoa física</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <PreviewStatus label="Cadastro iniciado" />
            <PreviewStatus label="Dados pessoais enviados" />
            <PreviewStatus label="Vendas habilitadas" />
          </div>
          <div className="mt-4 rounded-xl bg-primary px-3 py-2.5 text-center text-xs font-semibold text-primary-foreground">
            Ativar recebimentos
          </div>
        </div>

        <div
          data-tour-preview="seller-tabs"
          className="rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-4"
        >
          <div className="flex gap-1 rounded-xl bg-white/[0.035] p-1">
            <span className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-center text-xs font-semibold text-primary-foreground">
              Vendas
            </span>
            <span className="flex-1 rounded-lg px-3 py-2.5 text-center text-xs text-white/55">
              Meu catálogo
            </span>
            <span className="flex-1 rounded-lg px-3 py-2.5 text-center text-xs text-white/55">
              Loja
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {["Pedido #A91F2C", "Pedido #B338D1", "Pedido #C720AF"].map((order, index) => (
              <div
                key={order}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 px-3 py-3"
              >
                <div>
                  <p className="text-xs font-semibold text-white/70">{order}</p>
                  <p className="mt-1 text-[10px] text-white/35">
                    {index === 0 ? "Aguardando pagamento" : "Pago e entregue"}
                  </p>
                </div>
                <span className="text-xs font-semibold text-white/65">
                  R$ {index === 0 ? "24,90" : index === 1 ? "39,90" : "19,90"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OfflineDemoCard({
  title,
  subtitle,
  type,
  progress,
}: {
  title: string;
  subtitle: string;
  type: string;
  progress: string;
}) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-white/9 bg-black/20 p-3">
      <div className="grid h-20 w-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/35 via-white/10 to-black/45">
        <BookOpen className="size-5 text-white/65" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            {type}
          </span>
          <Download className="size-3 text-primary" />
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-white/80">{title}</p>
        <p className="text-xs text-white/40">{subtitle}</p>
        <p className="mt-1 text-[10px] text-primary/80">{progress}</p>
      </div>
    </article>
  );
}

function SellerMetric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/9 bg-white/[0.025] p-3.5">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="size-4" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-white/35">{note}</p>
    </div>
  );
}

function PreviewStatus({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-xs text-white/55">
      <CheckCircle2 className="size-3.5 text-primary" />
      <span>{label}</span>
    </div>
  );
}

export function SystemTutorial({ request }: { request: { id: number; chapter: TutorialChapter } }) {
  const lastRequestId = useRef<number>(0);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [chapter, setChapter] = useState<TutorialChapter | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [targetReady, setTargetReady] = useState(false);
  const [targetMode, setTargetMode] = useState<"actual" | "preview" | null>(null);
  const [tooltipSize, setTooltipSize] = useState<TooltipSize>({ width: 390, height: 300 });
  const returnPathRef = useRef(pathname);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => {
    if (!chapter) return [];
    return chapter === "all" ? ALL_STEPS : CHAPTERS[chapter];
  }, [chapter]);
  const step = steps[stepIndex];

  const close = useCallback(
    (completed = false) => {
      if (completed) emitTutorialComplete();
      setChapter(null);
      setStepIndex(0);
      setRect(null);
      setTargetReady(false);
      setTargetMode(null);
      const returnPath = returnPathRef.current;
      if (completed && returnPath && returnPath !== pathname && !returnPath.startsWith("/ler/")) {
        void navigate({ to: returnPath as any } as any);
      }
    },
    [navigate, pathname],
  );

  const start = useCallback(
    (nextChapter: TutorialChapter) => {
      if (nextChapter === "reader" && !pathname.startsWith("/ler/")) return;
      returnPathRef.current = pathname;
      setChapter(nextChapter);
      setStepIndex(0);
      setRect(null);
      setTargetReady(false);
      setTargetMode(null);
    },
    [pathname],
  );

  useEffect(() => {
    if (lastRequestId.current === request.id) return;
    lastRequestId.current = request.id;
    start(request.chapter);
  }, [request, start]);

  useEffect(() => {
    if (!step?.path || samePath(pathname, step.path)) return;
    setRect(null);
    setTargetReady(false);
    setTargetMode(null);
    void navigate({ to: step.path as any } as any);
  }, [navigate, pathname, step]);

  useEffect(() => {
    if (!step || !samePath(pathname, step.path)) return;

    let cancelled = false;
    let frame = 0;
    let observer: MutationObserver | null = null;

    const findTarget = () => {
      // Menus laterais podem existir no DOM, mas estar ocultos no mobile.
      // Nunca use um elemento sem dimensões como alvo do tutorial.
      const firstVisible = (selector?: string) =>
        selector
          ? Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
              const bounds = element.getBoundingClientRect();
              return bounds.width >= 2 && bounds.height >= 2;
            }) ?? null
          : null;
      const actual = firstVisible(step.selector);
      if (actual) return { element: actual, mode: "actual" as const };
      const preview = firstVisible(step.previewSelector);
      if (preview) return { element: preview, mode: "preview" as const };
      return { element: null, mode: null };
    };

    const update = () => {
      if (cancelled) return;
      if (!step.selector) {
        setTargetReady(true);
        setTargetMode(null);
        setRect(null);
        return;
      }

      const result = findTarget();
      const target = result.element;
      if (!target) {
        setTargetReady(false);
        setTargetMode(null);
        setRect(null);
        return;
      }

      const bounds = target.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) {
        setTargetReady(false);
        setTargetMode(null);
        setRect(null);
        return;
      }

      setTargetReady(true);
      setTargetMode(result.mode);
      const padding = 8;
      const top = Math.max(8, bounds.top - padding);
      const left = Math.max(8, bounds.left - padding);
      const right = Math.min(window.innerWidth - 8, bounds.right + padding);
      const bottom = Math.min(window.innerHeight - 8, bounds.bottom + padding);
      setRect({
        top,
        left,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      });
    };

    const locate = () => {
      const result = findTarget();
      if (result.element && result.mode === "actual") {
        const bounds = result.element.getBoundingClientRect();
        const outsideViewport = bounds.top < 80 || bounds.bottom > window.innerHeight - 80;
        if (outsideViewport) result.element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      window.setTimeout(update, result.mode === "preview" ? 40 : 220);
    };

    frame = window.requestAnimationFrame(locate);
    observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [pathname, step]);

  useEffect(() => {
    if (!chapter || !tooltipRef.current) return;
    const element = tooltipRef.current;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setTooltipSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [chapter, stepIndex, targetMode]);

  if (!chapter || !step || typeof document === "undefined") return null;

  const isLast = stepIndex >= steps.length - 1;
  const waitingForRoute = !!step.path && !samePath(pathname, step.path);
  const hasTarget = !!step.selector && targetReady && !!rect;
  const tooltipStyle = getTooltipStyle(hasTarget ? rect : null, tooltipSize);
  const showingPreview = !!step.preview && targetMode !== "actual";

  return createPortal(
    <div
      className="fixed inset-0 z-[1000]"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial do BookSyde"
    >
      <TutorialPreviewSurface
        {...(step.preview ? { kind: step.preview } : {})}
        visible={showingPreview}
      />

      {hasTarget ? (
        <>
          <div
            className="fixed left-0 right-0 top-0 bg-black/82 backdrop-blur-[1px]"
            style={{ height: rect!.top }}
          />
          <div
            className="fixed bottom-0 left-0 right-0 bg-black/82 backdrop-blur-[1px]"
            style={{ top: rect!.bottom }}
          />
          <div
            className="fixed left-0 bg-black/82 backdrop-blur-[1px]"
            style={{ top: rect!.top, width: rect!.left, height: rect!.height }}
          />
          <div
            className="fixed right-0 bg-black/82 backdrop-blur-[1px]"
            style={{ top: rect!.top, left: rect!.right, height: rect!.height }}
          />
          <div
            className="pointer-events-none fixed z-[1001] rounded-[1.2rem] border-2 border-primary shadow-[0_0_0_4px_rgba(255,255,255,.05),0_0_42px_rgba(255,255,255,.10)]"
            style={{ top: rect!.top, left: rect!.left, width: rect!.width, height: rect!.height }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/86 backdrop-blur-[2px]" />
      )}

      <div
        ref={tooltipRef}
        className="fixed z-[1002] w-[min(390px,calc(100vw-24px))] rounded-[1.5rem] border border-white/12 bg-[#111113]/98 p-5 text-white shadow-2xl sm:p-6"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              {step.eyebrow}
            </p>
            <p className="mt-1 text-xs text-white/45">
              Etapa {stepIndex + 1} de {steps.length}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close(false)}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar tutorial"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
            <CircleHelp className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold leading-tight">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/68">{step.description}</p>
            {step.hint ? <p className="mt-3 text-xs leading-5 text-white/42">{step.hint}</p> : null}
            {step.selector && !waitingForRoute && !targetReady && !step.preview ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-white/55">
                Este recurso pode não estar visível nesta conta ou ainda não possuir dados para ser
                exibido.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((stepIndex + 1) / Math.max(steps.length, 1)) * 100}%` }}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft className="size-4" /> Voltar
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (isLast) close(true);
              else setStepIndex((current) => Math.min(steps.length - 1, current + 1));
            }}
          >
            {isLast ? "Concluir" : "Próximo"}
            {!isLast ? <ChevronRight className="size-4" /> : null}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

