import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type Step = { title: string; text: string; route: string; note?: string };
const STEPS: Step[] = [
  { title:"Dashboard da editora", text:"Aqui você acompanha obras, publicações, vendas, receita, acessos e desempenho. Nesta conta os números são demonstrativos e ficam isolados das métricas oficiais.", route:"/dashboard" },
  { title:"Visitas e países", text:"No Dashboard você também visualiza a evolução de acessos e a distribuição por país.", route:"/dashboard", note:"O gráfico de países ainda está em planejamento e desenvolvimento. Os dados exibidos nesta demonstração são fictícios." },
  { title:"Estúdio", text:"Este é o espaço de produção da editora: crie obras, envie capas e arquivos, organize volumes e capítulos, idiomas e configurações de publicação.", route:"/studio" },
  { title:"Biblioteca", text:"Aqui a editora visualiza e organiza o conteúdo disponível na conta e pode abrir as publicações para conferir a experiência de leitura.", route:"/biblioteca" },
  { title:"Gestão editorial", text:"A Gestão editorial concentra os recursos administrativos e operacionais próprios da editora.", route:"/editora" },
  { title:"Personalização", text:"Em Personalização você define a aparência do catálogo e a experiência do leitor. Um único estilo de catálogo passa a valer para mangás, HQs, gibis e livros.", route:"/conta?tab=catalog" },
];

export function startPublisherDemoTour() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mangaka:publisher-demo-tour"));
}

export function PublisherDemoTour() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDemo, setIsDemo] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !user) { setIsDemo(false); setOpen(false); return; }
    let alive = true;
    void supabase.from("demo_accounts").select("enabled,tutorial_enabled").eq("user_id", user.id).maybeSingle().then(({data}) => {
      if (!alive) return;
      const enabled = Boolean(data?.enabled && data?.tutorial_enabled);
      setIsDemo(enabled);
      if (enabled && sessionStorage.getItem(`publisher-demo-tour:${user.id}:closed`) !== "1") setOpen(true);
    });
    return () => { alive = false; };
  }, [loading, user?.id]);

  useEffect(() => {
    const restart = () => { if (isDemo) { setStep(0); setOpen(true); if (user) sessionStorage.removeItem(`publisher-demo-tour:${user.id}:closed`); } };
    window.addEventListener("mangaka:publisher-demo-tour", restart);
    return () => window.removeEventListener("mangaka:publisher-demo-tour", restart);
  }, [isDemo, user]);

  const current = STEPS[step];
  const path = useMemo(() => current.route.split("?")[0], [current.route]);
  useEffect(() => {
    if (!open || !isDemo) return;
    if (location.pathname === path) return;
    void navigate({ to: current.route as never });
  }, [open, isDemo, step, path]);

  if (!open || !isDemo) return null;
  const close = () => { setOpen(false); if (user) sessionStorage.setItem(`publisher-demo-tour:${user.id}:closed`, "1"); };
  const go = (next:number) => setStep(Math.max(0, Math.min(STEPS.length - 1, next)));

  return <div className="fixed inset-0 z-[1300] pointer-events-none">
    <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
    <div className="pointer-events-auto absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 w-[min(92vw,620px)] -translate-x-1/2 rounded-[1.5rem] border border-primary/30 bg-card/95 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5"/></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Tour da editora · {step+1}/{STEPS.length}</p><h2 className="mt-1 font-display text-xl sm:text-2xl">{current.title}</h2></div><button onClick={close} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Encerrar tutorial"><X className="size-4"/></button></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{current.text}</p>{current.note ? <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5"><strong>Em desenvolvimento.</strong> {current.note}</div> : null}</div></div>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${((step+1)/STEPS.length)*100}%`}}/></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" size="sm" onClick={close}>Pular tutorial</Button><div className="flex gap-2"><Button variant="outline" size="sm" disabled={step===0} onClick={()=>go(step-1)}><ArrowLeft className="mr-1 size-4"/>Anterior</Button>{step < STEPS.length-1 ? <Button size="sm" onClick={()=>go(step+1)}>Próximo<ArrowRight className="ml-1 size-4"/></Button> : <Button size="sm" onClick={close}>Concluir</Button>}</div></div>
    </div>
  </div>;
}
