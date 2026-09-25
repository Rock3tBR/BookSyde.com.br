import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Maximize2, Minimize2, Settings2, X, MoveDown, MoveHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canUseRealFullscreen } from "@/lib/fullscreen";
import { MobileBookOpeningLottie } from "@/components/MobileBookOpeningLottie";
import { openReaderPdf } from "@/lib/pdfReader";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type PdfDoc = any;
type Bg = "black" | "gray" | "sepia";
type ReadingMode = "paged" | "vertical";

export function DrivePdfReader({ volumeId }: { volumeId: string }) {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const verticalScrollRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfSignalRef = useRef<AbortSignal | null>(null);
  const pointerStart = useRef<{x:number;y:number}|null>(null);
  const completedAtRef = useRef<string | null>(null);
  const [pdf, setPdf] = useState<PdfDoc>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [chrome, setChrome] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [background, setBackground] = useState<Bg>("black");
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [readingMode, setReadingMode] = useState<ReadingMode>("paged");
  const [progressReady, setProgressReady] = useState(false);
  const [meta, setMeta] = useState<{title:string;slug:string;number:number}|null>(null);

  useEffect(() => { setFullscreenAvailable(canUseRealFullscreen()); }, []);
  useEffect(() => {
    const fn=()=>setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange",fn); return()=>document.removeEventListener("fullscreenchange",fn);
  },[]);

  useEffect(() => {
    let dead=false;
    const controller = new AbortController();
    pdfSignalRef.current = controller.signal;
    setPdf(null);
    setError("");
    setMeta(null);
    setPage(1);
    setProgressReady(false);
    completedAtRef.current = null;
    // The title should not delay the first PDF page.
    void (async () => {
      const volumeRes = await supabase.from("volumes")
        .select("number, mangas(slug,title)").eq("id", volumeId)
        .abortSignal(controller.signal).maybeSingle();
      if (!dead && volumeRes.data) {
        const m = volumeRes.data.mangas as any;
        setMeta({ title: m?.title ?? "Leitura", slug: m?.slug ?? "", number: volumeRes.data.number ?? 0 });
      }
    })().catch(() => {});
    (async()=>{
      try {
        const doc=await openReaderPdf(volumeId, controller.signal);
        if(!dead) setPdf(doc);
      } catch(e) { if(!dead) setError(e instanceof Error?e.message:"Erro ao abrir PDF."); }
    })();
    return()=>{dead=true;renderTaskRef.current?.cancel?.();controller.abort();};
  },[volumeId]);

  useEffect(()=>{
    if(!pdf||!canvasRef.current||readingMode!=="paged") return;
    let cancelled=false;
    (async()=>{
      try {
        const p=await pdf.getPage(page); if(cancelled||!canvasRef.current)return;
        const base=p.getViewport({scale:1});
        const maxW=Math.min(window.innerWidth, 1200);
        const maxH=Math.max(320, window.innerHeight - 16);
        const scale=Math.min(maxW/base.width,maxH/base.height) * Math.min(window.devicePixelRatio||1,2);
        const viewport=p.getViewport({scale}); const c=canvasRef.current;
        c.width=Math.floor(viewport.width); c.height=Math.floor(viewport.height);
        c.style.width=`${Math.floor(viewport.width/Math.min(window.devicePixelRatio||1,2))}px`;
        c.style.height=`${Math.floor(viewport.height/Math.min(window.devicePixelRatio||1,2))}px`;
        renderTaskRef.current?.cancel?.();
        const task=p.render({canvasContext:c.getContext("2d")!,viewport}); renderTaskRef.current=task;
        await task.promise;
      } catch(e:any) { if(e?.name!=="RenderingCancelledException"&&!cancelled)setError(e?.message||"Erro ao renderizar página."); }
    })();
    return()=>{cancelled=true;renderTaskRef.current?.cancel?.();};
  },[pdf,page,readingMode]);

  // Restaura o progresso antes de liberar qualquer gravação. Isso evita que a
  // página 1 inicial sobrescreva a posição salva ao abrir um PDF do Drive.
  useEffect(() => {
    if (!pdf) return;
    let active = true;

    void (async () => {
      const localPage = Number(window.localStorage.getItem(`mangaka-page-${volumeId}`));
      const localUpdatedAt = Number(window.localStorage.getItem(`mangaka-page-updated-${volumeId}`));
      let savedIndex = Number.isFinite(localPage) && localPage >= 0 ? Math.floor(localPage) : 0;
      let completedAt = window.localStorage.getItem(`mangaka-completed-${volumeId}`);

      if (user && navigator.onLine) {
        const withCompletion = await supabase
          .from("reading_progress")
          .select("page_index, updated_at, completed_at")
          .eq("user_id", user.id)
          .eq("volume_id", volumeId)
          .maybeSingle();

        let remote = withCompletion.data as { page_index: number; updated_at: string; completed_at: string | null } | null;
        if (withCompletion.error?.message.includes("completed_at")) {
          const fallback = await supabase
            .from("reading_progress")
            .select("page_index, updated_at")
            .eq("user_id", user.id)
            .eq("volume_id", volumeId)
            .maybeSingle();
          if (fallback.error) {
            console.error("Não foi possível carregar o progresso do PDF", fallback.error);
          } else if (fallback.data) {
            remote = { ...fallback.data, completed_at: null };
          }
        } else if (withCompletion.error) {
          console.error("Não foi possível carregar o progresso do PDF", withCompletion.error);
        }

        if (remote && typeof remote.page_index === "number") {
          const remoteUpdatedAt = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
          const hasNewerLocalProgress =
            Number.isFinite(localUpdatedAt) && localUpdatedAt > 0 && localUpdatedAt > remoteUpdatedAt;
          if (!hasNewerLocalProgress) savedIndex = remote.page_index;
          completedAt = remote.completed_at ?? completedAt;
        }
      }

      if (!active) return;
      const clampedIndex = Math.max(0, Math.min(pdf.numPages - 1, savedIndex));
      completedAtRef.current = completedAt;
      setPage(clampedIndex + 1);
      setProgressReady(true);
    })();

    return () => { active = false; };
  }, [pdf, user?.id, volumeId]);

  // Salva localmente e sincroniza com o banco após a restauração inicial.
  useEffect(() => {
    if (!pdf || !progressReady) return;
    const pageIndex = Math.max(0, page - 1);
    window.localStorage.setItem(`mangaka-page-${volumeId}`, String(pageIndex));
    window.localStorage.setItem(`mangaka-page-updated-${volumeId}`, String(Date.now()));

    if (page >= pdf.numPages && !completedAtRef.current) {
      completedAtRef.current = new Date().toISOString();
      window.localStorage.setItem(`mangaka-completed-${volumeId}`, completedAtRef.current);
    }

    if (!user || !navigator.onLine) return;
    const timeout = window.setTimeout(async () => {
      const payload = {
        user_id: user.id,
        volume_id: volumeId,
        page_index: pageIndex,
        updated_at: new Date().toISOString(),
      };
      const result = await supabase
        .from("reading_progress")
        .upsert({ ...payload, completed_at: completedAtRef.current }, { onConflict: "user_id,volume_id" });

      if (result.error?.message.includes("completed_at")) {
        const fallback = await supabase
          .from("reading_progress")
          .upsert(payload, { onConflict: "user_id,volume_id" });
        if (fallback.error) {
          console.error("Não foi possível salvar o progresso do PDF", fallback.error);
          toast.error("Não foi possível sincronizar seu progresso.");
        }
      } else if (result.error) {
        console.error("Não foi possível salvar o progresso do PDF", result.error);
        toast.error("Não foi possível sincronizar seu progresso.");
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [page, pdf, progressReady, user?.id, volumeId]);

  useEffect(() => {
    if (readingMode !== "vertical" || !progressReady || !verticalScrollRef.current) return;
    const root = verticalScrollRef.current;
    const frame = window.requestAnimationFrame(() => {
      root.querySelector<HTMLElement>(`[data-drive-page="${page}"]`)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
    // O scroll inicial acontece ao entrar no modo vertical; mudanças posteriores
    // de página causadas pelo próprio scroll não devem reposicionar a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingMode, progressReady, volumeId]);

  const prev=useCallback(()=>setPage(p=>Math.max(1,p-1)),[]);
  const next=useCallback(()=>setPage(p=>pdf?Math.min(pdf.numPages,p+1):p),[pdf]);
  const toggleFullscreen=async()=>{if(document.fullscreenElement){await document.exitFullscreen();setChrome(true);}else if(rootRef.current?.requestFullscreen){await rootRef.current.requestFullscreen({navigationUI:"hide"});setChrome(false);}};
  const bg=background==="black"?"#050505":background==="gray"?"#353535":"#c8b894";

  const renderVerticalPage = useCallback(async (pageNumber:number, canvas:HTMLCanvasElement) => {
    if (!pdf || canvas.dataset["rendered"] === "1") return;
    const signal = pdfSignalRef.current;
    try {
    const p = await pdf.getPage(pageNumber);
    if (signal?.aborted || !canvas.isConnected) return;
    const base = p.getViewport({scale:1});
    const cssWidth = Math.min(window.innerWidth, 1000);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = p.getViewport({scale:(cssWidth/base.width)*dpr});
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width/dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height/dpr)}px`;
    await p.render({canvasContext:canvas.getContext("2d")!,viewport}).promise;
    canvas.dataset["rendered"] = "1";
    } catch (error) {
      if (!signal?.aborted && canvas.isConnected) setError(error instanceof Error ? error.message : "Erro ao renderizar página.");
    }
  }, [pdf]);

  if(error) return <div className="flex min-h-[100dvh] items-center justify-center bg-black p-8 text-center text-white"><p>{error}</p></div>;
  if(!pdf) return <MobileBookOpeningLottie />;

  return <div ref={rootRef} className="relative flex h-[100dvh] w-full flex-col overflow-hidden text-white" style={{backgroundColor:bg}}>
    {chrome && <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/90 via-black/70 to-transparent px-3 pb-8 pt-[max(.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{meta?.title??"Leitura"}</p><p className="text-xs text-white/55">Volume {meta?.number??""} · Página {page} de {pdf.numPages}</p></div>
        <div role="group" aria-label="Modo de leitura" className="inline-flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 p-1">
          <button type="button" onClick={()=>setReadingMode("paged")} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${readingMode==="paged"?"bg-white/15 text-white":"text-white/55 hover:bg-white/10"}`}><MoveHorizontal className="size-3.5"/> Páginas</button>
          <button type="button" onClick={()=>{setReadingMode("vertical");setChrome(false)}} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${readingMode==="vertical"?"bg-white/15 text-white":"text-white/55 hover:bg-white/10"}`}><MoveDown className="size-3.5"/> Scroll</button>
        </div>
        <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="size-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"><Settings2 className="size-[18px]"/></Button></PopoverTrigger><PopoverContent side="bottom" align="end" className="z-[70] w-72 rounded-2xl border-white/15 bg-[#202020] p-4 text-white"><p className="text-sm font-semibold">Configurações da leitura</p><label className="mt-4 block text-xs text-white/70">Brilho · {brightness}%</label><input className="mt-2 w-full" type="range" min="45" max="120" value={brightness} onChange={e=>setBrightness(Number(e.target.value))}/><p className="mb-2 mt-4 border-t border-white/10 pt-4 text-xs text-white/70">Fundo</p><div className="grid grid-cols-3 gap-2">{([['black','Preto','#050505'],['gray','Cinza','#353535'],['sepia','Sépia','#c8b894']] as const).map(([v,l,c])=><button key={v} onClick={()=>setBackground(v)} className={`rounded-xl border p-2 text-[11px] ${background===v?'border-white/65 bg-white/10':'border-white/10 text-white/60'}`}><span className="mx-auto mb-1 block size-6 rounded-full border border-white/20" style={{backgroundColor:c}}/>{l}</button>)}</div></PopoverContent></Popover>
        {fullscreenAvailable&&<Button variant="ghost" size="icon" className="size-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize2 className="size-[18px]"/>:<Maximize2 className="size-[18px]"/>}</Button>}
        <Button variant="ghost" size="icon" className="size-10 rounded-xl text-white hover:bg-white/10" asChild><Link to="/manga/$slug" params={{slug:meta?.slug??""}} search={{invite:""}}><X className="size-[18px]"/></Link></Button>
      </div>
    </div>}

    {readingMode === "paged" ? (
      <div className="relative flex flex-1 touch-none items-center justify-center overflow-hidden" style={{filter:`brightness(${brightness}%)`}}
        onClick={()=>setChrome(v=>!v)}
        onPointerDown={e=>{pointerStart.current={x:e.clientX,y:e.clientY}}}
        onPointerUp={e=>{const s=pointerStart.current;pointerStart.current=null;if(!s)return;const dx=e.clientX-s.x;if(Math.abs(dx)>55){e.stopPropagation();dx<0?next():prev();}}}>
        <canvas ref={canvasRef} className="block max-h-full max-w-full select-none object-contain"/>
      </div>
    ) : (
      <div ref={verticalScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain" style={{filter:`brightness(${brightness}%)`}} onScroll={(e)=>{
        const root=e.currentTarget; setChrome(false);
        const els=Array.from(root.querySelectorAll<HTMLElement>("[data-drive-page]"));
        let best=page, bestDist=Infinity;
        for(const el of els){const d=Math.abs(el.getBoundingClientRect().top-root.getBoundingClientRect().top);if(d<bestDist){bestDist=d;best=Number(el.dataset["drivePage"])||best;}}
        if(best!==page)setPage(best);
      }} onClick={()=>setChrome(v=>!v)}>
        <div className="mx-auto flex w-full max-w-[1000px] flex-col items-center gap-1 py-2">
          {Array.from({length:pdf.numPages},(_,i)=>i+1).map(n=><DriveScrollPage key={n} pageNumber={n} renderPage={renderVerticalPage}/>)}
        </div>
      </div>
    )}

    {chrome&&readingMode==="paged"&&<div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-10">
      <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-black/75 p-2 shadow-2xl backdrop-blur-xl">
        <Button variant="ghost" className="flex-1 text-white hover:bg-white/10 hover:text-white" disabled={page<=1} onClick={e=>{e.stopPropagation();prev();}}>Anterior</Button>
        <button className="min-w-20 text-center text-xs font-medium text-white/65" onClick={e=>e.stopPropagation()}><BookOpen className="mr-1 inline size-3.5"/>{page}/{pdf.numPages}</button>
        <Button variant="ghost" className="flex-1 text-white hover:bg-white/10 hover:text-white" disabled={page>=pdf.numPages} onClick={e=>{e.stopPropagation();next();}}>Próxima</Button>
      </div>
      <div className="mx-auto mt-2 h-1 max-w-xl overflow-hidden rounded-full bg-white/10"><div className="h-full bg-primary transition-all" style={{width:`${(page/pdf.numPages)*100}%`}}/></div>
    </div>}
  </div>;
}


function DriveScrollPage({pageNumber,renderPage}:{pageNumber:number;renderPage:(n:number,c:HTMLCanvasElement)=>Promise<void>}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){void renderPage(pageNumber,canvas);io.disconnect();}},{rootMargin:"1200px 0px"});
    io.observe(canvas);return()=>io.disconnect();
  },[pageNumber,renderPage]);
  return <div data-drive-page={pageNumber} className="flex min-h-[55vh] w-full items-center justify-center"><canvas ref={ref} className="block max-w-full select-none"/></div>;
}
