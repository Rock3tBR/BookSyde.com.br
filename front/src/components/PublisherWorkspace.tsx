import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, Download, FileCheck2, MessageCircle, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ManagementNavigation } from "@/components/ManagementNavigation";
import { ManagementNotice } from "@/components/ManagementNotice";
import { PublisherContractPanel } from "@/components/ContractsManager";
import { PublicationCover } from "@/components/PublicationCover";
import { StudioDashboard } from "@/components/StudioDashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, useIsEditora, useIsAdmin } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatMarketplacePrice } from "@/lib/marketplace";

type PublisherSection = "overview" | "catalog" | "contracts" | "finance" | "reports" | "settings";
type Work = { id: string; title: string; slug: string; cover_url: string | null; work_type: string; distribution_channel: string | null; visibility: string; price_cents: number | null; created_at: string; view_count?: number | null };
type Purchase = { manga_id: string; amount_cents: number; status: string; created_at?: string };
const db = supabase as any;
const labels: Record<PublisherSection, string> = { overview: "Gestão editorial", catalog: "Meu catálogo", contracts: "Contratos e licenças", finance: "Financeiro editorial", reports: "Relatórios", settings: "Configurações" };

export function PublisherWorkspace({ section = "overview" }: { section?: PublisherSection }) {
  const { user, loading } = useAuth();
  const { data: isEditora, isLoading: checkingEditora } = useIsEditora();
  const { data: isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const allowed = !!user && (!!isEditora || !!isAdmin);
  const works = useQuery({
    queryKey: ["publisher-own-works", user?.id], enabled: allowed,
    queryFn: async () => {
      // Na ausência de vínculo organizacional no esquema atual, a delimitação é
      // SOMENTE creator_id = auth.uid(). Não ampliar para outras editoras.
      const { data, error } = await db.from("mangas")
        .select("id,title,slug,cover_url,work_type,distribution_channel,visibility,price_cents,created_at,view_count")
        .eq("creator_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Work[];
    },
  });
  const workIds = useMemo(() => (works.data ?? []).map(w => w.id), [works.data]);
  const purchases = useQuery({
    queryKey: ["publisher-own-purchases", user?.id, workIds.join(",")],
    enabled: allowed && works.isSuccess && workIds.length > 0 && (section === "finance" || section === "overview"),
    queryFn: async () => {
      const { data, error } = await db.from("purchases").select("manga_id,amount_cents,status,created_at").in("manga_id", workIds).limit(1000);
      if (error) throw error;
      return (data ?? []) as Purchase[];
    },
  });
  if (loading || checkingEditora || checkingAdmin) return <main className="p-8 text-sm text-muted-foreground">Verificando permissões…</main>;
  if (!allowed) return <main className="p-8 text-sm text-muted-foreground">Gestão editorial exclusiva para editoras e administradores.</main>;
  const paid = (purchases.data ?? []).filter(p => p.status === "paid");
  const gross = paid.reduce((sum, p) => sum + Number(p.amount_cents), 0);
  const content = <div className="min-w-0 space-y-5">
    {works.isError ? <ManagementNotice title="Catálogo não disponível" description="Não foi possível consultar suas obras. Confirme as permissões e as políticas RLS do Supabase." /> : null}
    {works.isLoading ? <p className="text-sm text-muted-foreground">Carregando suas obras…</p> : null}
    {section === "overview" && works.isSuccess ? <PublisherDashboardOverview works={works.data} paid={paid} gross={gross} /> : null}
    {section === "catalog" && works.isSuccess ? <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{works.data.map(w=><article key={w.id} className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/65"><div className="aspect-[3/2] bg-muted/40"><PublicationCover coverUrl={w.cover_url} workType={w.work_type} title={w.title} fit="contain" className="h-full w-full" fallback={<div className="grid h-full place-items-center"><BookOpen className="size-8 text-muted-foreground" /></div>}/></div><div className="space-y-2 p-4"><h2 className="line-clamp-2 text-sm font-semibold">{w.title}</h2><div className="flex flex-wrap gap-2"><Badge variant="outline">{w.visibility}</Badge><Badge variant="outline">{w.distribution_channel ?? "Sem canal"}</Badge></div><p className="text-sm">Preço cadastrado: {formatMarketplacePrice(w.price_cents ?? 0)}</p><Button asChild variant="outline" size="sm" className="w-full"><Link to="/studio" search={{obra: w.id,aba:"volumes"}}>Gerenciar conteúdo <ArrowUpRight className="size-3" /></Link></Button></div></article>)}{!works.data.length ? <ManagementNotice title="Seu catálogo está vazio" description="Crie sua primeira obra pelo Estúdio. Os conteúdos de outras contas nunca serão incluídos automaticamente aqui."/> : null}</div> : null}
    {section === "contracts" ? <PublisherContractPanel publisherId={user.id} /> : null}
    {section === "finance" ? <><ManagementNotice title="Royalties e saldo: integração pendente" description="O sistema atual não oferece lançamentos contratuais e conciliação de repasses por editora. Dados de compra, quando acessíveis, são apenas valores brutos de até 1.000 registros vinculados às suas próprias obras. Não representam lucro, royalty, saldo disponível ou dinheiro repassado." />
      {purchases.isSuccess && works.data?.length ? <div className="rounded-2xl border bg-card/60 p-5"><p className="text-sm text-muted-foreground">Vendas pagas observadas no catálogo*</p><p className="mt-2 font-display text-3xl">{formatMarketplacePrice(gross)}</p><p className="mt-2 text-xs text-muted-foreground">{paid.length} compra(s) confirmada(s) nos dados consultados. O sistema de assinatura e royalties precisa ser conectado separadamente.</p></div> : null}
      {purchases.isError ? <ManagementNotice title="Compras indisponíveis" description="A consulta foi bloqueada ou falhou. Não exibiremos R$ 0 como se o valor tivesse sido apurado; será necessário um extrato seguro e específico para a editora." /> : null}
    </> : null}
    {section === "reports" ? <><ManagementNotice title="Relatório da sua conta" description="Dados de obras e leitura são vinculados à conta atual. Um consolidado por organização ou remuneração contratual exige vínculo editorial e extrato validados."/><StudioDashboard userId={user.id}/></> : null}
    {section === "settings" ? <ManagementNotice title="Configurações editoriais" description="O cadastro organizacional, membros autorizados e condições de recebimento ainda exigem tabelas e políticas próprias. Dados bancários e contratos não serão salvos em campos genéricos do perfil. Para editar seus dados pessoais, use sua Conta." /> : null}
  </div>;

  // O dashboard principal da editora ocupa toda a largura disponível.
  // O menu lateral permanece nas demais páginas de Gestão editorial.
  if (section === "overview") {
    return <div className="w-full min-w-0 px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 lg:px-7 lg:py-7">{content}</div>;
  }

  return <ManagementNavigation area="publisher">{content}</ManagementNavigation>;
}

function PublisherDashboardOverview({ works, paid, gross: _gross }: { works: Work[]; paid: Purchase[]; gross: number }) {
  const [days, setDays] = useState(30);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const filteredPaid = paid.filter((purchase) => purchase.created_at && new Date(purchase.created_at) >= since);
  const gross = filteredPaid.reduce((sum, purchase) => sum + Number(purchase.amount_cents), 0);
  const periodLabel = days === 90 ? "3 meses" : `${days} dias`;
  const salesByDay = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const value = filteredPaid
      .filter((purchase) => purchase.created_at && new Date(purchase.created_at) >= date && new Date(purchase.created_at) < next)
      .reduce((sum, purchase) => sum + Number(purchase.amount_cents), 0) / 100;
    return { label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value };
  });
  const top = [...works]
    .sort((a, b) => Number((b as any).view_count ?? 0) - Number((a as any).view_count ?? 0))
    .slice(0, 5);

  const downloadSales = () => {
    const rows = [["Data", "Valor (R$)"], ...salesByDay.map((item) => [item.label, item.value.toFixed(2).replace(".", ",")])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `booksyde-editora-vendas-${days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-end justify-between gap-3 sm:justify-end">
        <div className="sm:hidden">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Editora</p>
          <h1 className="font-display text-2xl leading-tight">Dashboard</h1>
        </div>
        <select
          aria-label="Período do dashboard"
          className="h-10 min-w-0 rounded-xl border bg-background px-2.5 text-xs sm:px-3 sm:text-sm"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>3 meses</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-card p-3 sm:p-5">
          <div className="flex min-w-0 items-start gap-2.5 sm:items-center sm:gap-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-400/20 sm:size-14 sm:rounded-2xl"><BarChart3 className="size-4 sm:size-7" /></div>
            <div className="min-w-0"><p className="truncate text-[11px] font-semibold sm:text-sm">Valor vendido</p><p className="truncate font-display text-xl font-semibold sm:text-3xl">{formatMarketplacePrice(gross)}</p><p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">Últimos {periodLabel}</p></div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/10 to-card p-3 sm:p-5">
          <div className="flex min-w-0 items-start gap-2.5 sm:items-center sm:gap-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-400/15 sm:size-14 sm:rounded-2xl"><BookOpen className="size-4 sm:size-7" /></div>
            <div className="min-w-0"><p className="truncate text-[11px] font-semibold sm:text-sm">Livros no sistema</p><p className="font-display text-xl font-semibold sm:text-3xl">{works.length}</p><p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">{works.filter((work) => work.distribution_channel === "catalog").length} no catálogo</p></div>
          </div>
        </div>

        <div className="col-span-2 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-card p-3.5 sm:p-5 lg:col-span-1">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 sm:size-14 sm:rounded-2xl"><FileCheck2 className="size-5 sm:size-7" /></div>
            <div className="min-w-0 flex-1"><p className="font-semibold">Contrato da editora</p><p className="mt-0.5 text-xs text-muted-foreground">Acesse os dados e arquivos do contrato.</p></div>
            <Button asChild size="sm" className="shrink-0 rounded-xl"><Link to="/editora/contratos"><span className="hidden sm:inline">Acessar</span><ArrowRight className="size-4" /></Link></Button>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/60 p-3.5 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
          <div className="flex min-w-0 gap-2.5 sm:gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border sm:size-10"><TrendingUp className="size-4 sm:size-5" /></div>
            <div className="min-w-0"><h3 className="font-semibold">Evolução de vendas</h3><p className="hidden text-xs text-muted-foreground sm:block">Valor total de vendas da sua editora nos últimos {periodLabel}.</p></div>
          </div>
          <Button size="icon" variant="outline" className="hidden rounded-xl sm:inline-flex" title="Baixar relatório de vendas" aria-label="Baixar relatório de vendas" onClick={downloadSales}><Download className="size-4" /></Button>
        </div>
        <div className="h-[200px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesByDay} margin={{ left: 0, right: 6, top: 8, bottom: 0 }}>
              <defs><linearGradient id="publisherSales" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.45} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value) => `R$${value}`} fontSize={10} />
              <Tooltip formatter={(value: number) => [value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Valor"]} />
              <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="url(#publisherSales)" dot={false} activeDot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card/60 p-3.5 sm:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-3 sm:mb-3"><div><h3 className="font-semibold">Top 5 acessos</h3><p className="hidden text-xs text-muted-foreground sm:block">Obras mais visualizadas.</p></div></div>
          <div className="divide-y divide-border/60">
            {top.map((work, index) => (
              <div key={work.id} className="flex min-w-0 items-center gap-2.5 py-2.5 sm:gap-3 sm:py-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] sm:size-7 sm:text-xs">{index + 1}</span>
                <PublicationCover coverUrl={work.cover_url} workType={work.work_type} title={work.title} fit="cover" className="h-11 w-8 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/30 shadow-sm sm:h-12 sm:w-9" fallback={<div className="grid h-full w-full place-items-center"><BookOpen className="size-4 text-muted-foreground" /></div>} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{work.title}</p><p className="text-[11px] text-muted-foreground sm:text-xs">{work.work_type}</p></div>
                <span className="shrink-0 text-xs font-medium tabular-nums sm:text-sm">{Number((work as any).view_count ?? 0).toLocaleString("pt-BR")}</span>
              </div>
            ))}
            {!top.length ? <p className="py-7 text-center text-sm text-muted-foreground">Ainda não há obras para classificar.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/60 p-3.5 sm:p-5">
          <div className="mb-2.5 flex items-center gap-2.5 sm:mb-3 sm:gap-3"><MessageCircle className="size-4 sm:size-5" /><div><h3 className="font-semibold">Últimos comentários</h3><p className="hidden text-xs text-muted-foreground sm:block">Comentários recentes dos leitores nas suas obras.</p></div></div>
          <div className="grid min-h-[150px] place-items-center rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-center sm:min-h-[250px] sm:p-6">
            <div><MessageCircle className="mx-auto mb-2 size-6 text-muted-foreground sm:mb-3 sm:size-8" /><p className="text-sm font-medium">Sem comentários disponíveis</p><p className="mt-1 max-w-sm text-xs text-muted-foreground">Quando a consulta editorial estiver habilitada, os comentários recentes aparecerão aqui.</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
