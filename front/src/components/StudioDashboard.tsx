import { startPublisherDemoTour } from "@/components/PublisherDemoTour";
import { formatNumber } from "@/lib/numberFormat";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, Globe2, HelpCircle, RefreshCw, ShoppingBag, Trophy, WalletCards, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { WORK_TYPES } from "@/lib/publication";
import { formatMarketplacePrice } from "@/lib/marketplace";

// Algumas colunas usadas aqui (marketplace_orders, marketplace_order_items,
// purchases) ainda não estão 100% refletidas no types.ts gerado. Seguindo o
// mesmo padrão já usado em marketplace_.vendedor.tsx, tratamos o client como
// `any` só nestas consultas.
const db = supabase as any;

type OwnManga = {
  id: string;
  title: string;
  work_type: string;
  view_count: number | null;
  distribution_channel: string | null;
};

type Report = {
  works: number;
  publishedVolumes: number;
  sales: number;
  revenueCents: number;
  topWorks: Array<{
    id: string;
    title: string;
    workType: string;
    views: number;
    sales: number;
    revenueCents: number;
  }>;
};

const chartColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  color: "var(--color-foreground)",
  borderRadius: 12,
};

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell);
          return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(";"),
    )
    .join("\n");
  // BOM para o Excel reconhecer acentuação em UTF-8 corretamente.
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function RealStudioDashboard({ userId }: { userId: string }) {
  const worksQuery = useQuery({
    queryKey: ["studio-dashboard-works", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mangas")
        .select("id, title, work_type, view_count, distribution_channel")
        .eq("creator_id", userId);
      if (error) throw error;
      return (data ?? []) as OwnManga[];
    },
  });

  const mangaIds = useMemo(() => worksQuery.data?.map((manga) => manga.id) ?? [], [worksQuery.data]);

  const volumesQuery = useQuery({
    queryKey: ["studio-dashboard-volumes", mangaIds.join(",")],
    enabled: mangaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volumes")
        .select("manga_id, published")
        .in("manga_id", mangaIds);
      if (error) throw error;
      return (data ?? []) as Array<{ manga_id: string; published: boolean }>;
    },
  });

  const purchasesQuery = useQuery({
    queryKey: ["studio-dashboard-purchases", mangaIds.join(",")],
    enabled: mangaIds.length > 0,
    queryFn: async () => {
      // Vendas do Catálogo (preço definido pelo Admin). Contas Editora e
      // Criador comum publicam sempre gratuitamente no Catálogo, então esta
      // lista só terá linhas para contas Admin com preço > 0.
      const { data, error } = await db
        .from("purchases")
        .select("manga_id, amount_cents, status, created_at")
        .in("manga_id", mangaIds);
      if (error) throw error;
      return (data ?? []) as Array<{ manga_id: string; amount_cents: number; status: string; created_at: string }>;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["studio-dashboard-orders", userId],
    queryFn: async () => {
      // Vendas do Marketplace feitas por mim como vendedor.
      const { data, error } = await db
        .from("marketplace_orders")
        .select("id, status, paid_at")
        .eq("seller_id", userId);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; status: string; paid_at: string | null }>;
    },
  });

  const paidOrderIds = useMemo(
    () => (ordersQuery.data ?? []).filter((order) => order.paid_at).map((order) => order.id),
    [ordersQuery.data],
  );

  const orderItemsQuery = useQuery({
    queryKey: ["studio-dashboard-order-items", paidOrderIds.join(",")],
    enabled: paidOrderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_order_items")
        .select("order_id, manga_ids, price_cents")
        .in("order_id", paidOrderIds);
      if (error) throw error;
      return (data ?? []) as Array<{ order_id: string; manga_ids: string[]; price_cents: number }>;
    },
  });

  const loading =
    worksQuery.isPending ||
    (mangaIds.length > 0 && (volumesQuery.isPending || purchasesQuery.isPending)) ||
    ordersQuery.isPending ||
    (paidOrderIds.length > 0 && orderItemsQuery.isPending);

  const anyError =
    worksQuery.isError || volumesQuery.isError || purchasesQuery.isError || ordersQuery.isError || orderItemsQuery.isError;

  const report: Report | null = useMemo(() => {
    if (!worksQuery.data) return null;
    const works = worksQuery.data;
    const volumes = volumesQuery.data ?? [];
    // Considera venda válida qualquer compra que não esteja explicitamente
    // cancelada/reembolsada/recusada — ajuste esta lista se os status usados
    // no seu banco forem diferentes.
    const negativeStatuses = new Set(["refunded", "canceled", "cancelled", "failed", "expired"]);
    const purchases = (purchasesQuery.data ?? []).filter((row) => !negativeStatuses.has(row.status));
    const orderItems = orderItemsQuery.data ?? [];

    const publishedByManga = new Map<string, number>();
    for (const volume of volumes) {
      if (!volume.published) continue;
      publishedByManga.set(volume.manga_id, (publishedByManga.get(volume.manga_id) ?? 0) + 1);
    }

    const salesByManga = new Map<string, { sales: number; revenueCents: number }>();
    const addSale = (mangaId: string, revenueCents: number) => {
      const current = salesByManga.get(mangaId) ?? { sales: 0, revenueCents: 0 };
      current.sales += 1;
      current.revenueCents += revenueCents;
      salesByManga.set(mangaId, current);
    };

    for (const purchase of purchases) {
      addSale(purchase.manga_id, purchase.amount_cents);
    }
    for (const item of orderItems) {
      // Itens que agrupam várias obras (ex.: pasta/coleção) não têm como ser
      // atribuídos a uma única obra com precisão, então entram só no total.
      if (item.manga_ids.length === 1 && item.manga_ids[0]) {
        addSale(item.manga_ids[0], item.price_cents);
      }
    }

    const totalSales = purchases.length + orderItems.length;
    const totalRevenue =
      purchases.reduce((sum, row) => sum + row.amount_cents, 0) +
      orderItems.reduce((sum, row) => sum + row.price_cents, 0);
    const totalPublishedVolumes = volumes.filter((volume) => volume.published).length;

    const topWorks = works
      .map((manga) => {
        const sale = salesByManga.get(manga.id) ?? { sales: 0, revenueCents: 0 };
        return {
          id: manga.id,
          title: manga.title,
          workType: WORK_TYPES.find((type) => type.value === manga.work_type)?.label ?? manga.work_type,
          views: manga.view_count ?? 0,
          sales: sale.sales,
          revenueCents: sale.revenueCents,
        };
      })
      .sort((a, b) => b.sales - a.sales || b.views - a.views)
      .slice(0, 5);

    return {
      works: works.length,
      publishedVolumes: totalPublishedVolumes,
      sales: totalSales,
      revenueCents: totalRevenue,
      topWorks,
    };
  }, [worksQuery.data, volumesQuery.data, purchasesQuery.data, orderItemsQuery.data]);

  function handleDownloadReport() {
    if (!worksQuery.data) return;
    const volumes = volumesQuery.data ?? [];
    const negativeStatuses = new Set(["refunded", "canceled", "cancelled", "failed", "expired"]);
    const purchases = (purchasesQuery.data ?? []).filter((row) => !negativeStatuses.has(row.status));
    const orderItems = orderItemsQuery.data ?? [];

    const publishedByManga = new Map<string, number>();
    for (const volume of volumes) {
      if (volume.published) publishedByManga.set(volume.manga_id, (publishedByManga.get(volume.manga_id) ?? 0) + 1);
    }
    const salesByManga = new Map<string, { sales: number; revenueCents: number }>();
    const addSale = (mangaId: string, revenueCents: number) => {
      const current = salesByManga.get(mangaId) ?? { sales: 0, revenueCents: 0 };
      current.sales += 1;
      current.revenueCents += revenueCents;
      salesByManga.set(mangaId, current);
    };
    for (const purchase of purchases) addSale(purchase.manga_id, purchase.amount_cents);
    for (const item of orderItems) {
      if (item.manga_ids.length === 1 && item.manga_ids[0]) addSale(item.manga_ids[0], item.price_cents);
    }

    const rows: Array<Array<string | number>> = [
      ["Obra", "Formato", "Volumes publicados", "Visualizações", "Vendas", "Receita (R$)"],
      ...worksQuery.data.map((manga) => {
        const sale = salesByManga.get(manga.id) ?? { sales: 0, revenueCents: 0 };
        return [
          manga.title,
          WORK_TYPES.find((type) => type.value === manga.work_type)?.label ?? manga.work_type,
          publishedByManga.get(manga.id) ?? 0,
          manga.view_count ?? 0,
          sale.sales,
          (sale.revenueCents / 100).toFixed(2).replace(".", ","),
        ];
      }),
    ];

    downloadCsv(`relatorio-estudio-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const topWorksData = (report?.topWorks ?? []).map((work) => ({
    ...work,
    shortTitle: work.title.length > 18 ? `${work.title.slice(0, 18)}…` : work.title,
  }));

  const valueData = useMemo(() => {
    const negativeStatuses = new Set(["refunded", "canceled", "cancelled", "failed", "expired"]);
    const catalog = (purchasesQuery.data ?? [])
      .filter((row) => !negativeStatuses.has(row.status))
      .reduce((sum, row) => sum + row.amount_cents, 0);
    const marketplace = (orderItemsQuery.data ?? []).reduce((sum, row) => sum + row.price_cents, 0);
    return [
      { name: "Catálogo", value: catalog, fill: "var(--color-chart-1)" },
      { name: "Marketplace", value: marketplace, fill: "var(--color-chart-2)" },
    ];
  }, [purchasesQuery.data, orderItemsQuery.data]);

  const totalValue = valueData.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="min-w-0 space-y-4" aria-label="Dashboard do estúdio">
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={!report} onClick={handleDownloadReport}>
          <Download /> Baixar relatório (CSV)
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            void worksQuery.refetch();
            void volumesQuery.refetch();
            void purchasesQuery.refetch();
            void ordersQuery.refetch();
            void orderItemsQuery.refetch();
          }}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      {anyError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p>Não foi possível carregar o dashboard.</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente atualizar os dados.</p>
        </div>
      ) : null}

      {loading && !report ? (
        <div role="status" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
          <span className="sr-only">Carregando indicadores…</span>
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Obras", value: report.works, icon: BookOpen, detail: "Cadastradas por você" },
              { label: "Arquivos publicados", value: report.publishedVolumes, icon: BookOpen, detail: "Volumes/capítulos publicados" },
              { label: "Vendas", value: report.sales, icon: ShoppingBag, detail: "Catálogo + Marketplace" },
              { label: "Receita", value: report.revenueCents / 100, icon: Trophy, detail: "Bruta, antes de taxas", isCurrency: true },
            ].map((metric) => (
              <article key={metric.label} className="ink-panel min-w-0 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground sm:text-sm">{metric.label}</span>
                  <metric.icon className="size-4 shrink-0 text-primary" />
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums sm:text-3xl">
                  {metric.isCurrency ? formatMarketplacePrice(Math.round(metric.value * 100), "BRL") : formatNumber(metric.value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
              </article>
            ))}
          </div>

          <section className="ink-panel min-w-0 rounded-2xl p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Vendas e visualizações</h3>
                <p className="text-xs text-muted-foreground">Comparativo das suas obras com melhor desempenho.</p>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[var(--color-chart-1)]" /> Visualizações</span>
                <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[var(--color-chart-2)]" /> Vendas</span>
              </div>
            </div>
            {topWorksData.length ? (
              <div className="h-[310px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={topWorksData} margin={{ left: 0, right: 10, top: 15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.72}/><stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.03}/></linearGradient>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.62}/><stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.03}/></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.55} />
                    <XAxis dataKey="shortTitle" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={38} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatNumber(Number(value)), name === "views" ? "Visualizações" : "Vendas"]} />
                    <Area type="monotone" dataKey="views" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#viewsFill)" />
                    <Area type="monotone" dataKey="sales" stroke="var(--color-chart-2)" strokeWidth={2.5} fill="url(#salesFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma obra publicada ainda.</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="ink-panel min-w-0 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-lg font-semibold">Valores</h3><p className="text-xs text-muted-foreground">Receita por canal de venda.</p></div>
                <WalletCards className="size-5 text-primary" />
              </div>
              <div className="mt-5 grid items-center gap-5 sm:grid-cols-[190px_1fr]">
                <div className="relative mx-auto size-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={valueData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={totalValue ? 3 : 0} stroke="none">{valueData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatMarketplacePrice(Number(value), "BRL"), "Receita"]} /></PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><span className="text-[10px] text-muted-foreground">Total</span><strong className="text-lg">{formatMarketplacePrice(totalValue, "BRL")}</strong></div>
                </div>
                <div className="space-y-3">
                  {valueData.map((item) => {
                    const pct = totalValue ? (item.value / totalValue) * 100 : 0;
                    return <div key={item.name}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{item.name}</span><strong>{formatMarketplacePrice(item.value, "BRL")}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.fill }} /></div><p className="mt-1 text-right text-[10px] text-muted-foreground">{pct.toFixed(1)}%</p></div>;
                  })}
                </div>
              </div>
            </section>

            <section className="ink-panel min-w-0 rounded-2xl p-5">
              <h3 className="text-lg font-semibold">Obras com melhor desempenho</h3>
              <p className="text-xs text-muted-foreground">Vendas e visualizações registradas por obra.</p>
              <div className="mt-4 space-y-2">
                {report.topWorks.map((work, index) => (
                  <div key={work.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/35 p-3 text-sm">
                    <span className="flex min-w-0 items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><span className="min-w-0"><span className="block truncate font-medium">{work.title}</span><span className="text-xs text-muted-foreground">{work.workType}</span></span></span>
                    <span className="shrink-0 text-right text-xs"><strong className="block">{formatNumber(work.sales)} vendas</strong><span className="text-muted-foreground">{formatNumber(work.views)} visualizações</span></span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );

}

type DemoMetric = { metric_key: string; metric_label: string; metric_value: number };
type DemoAccess = { month_number: number; unique_visitors: number; visits: number; page_views: number };
type DemoCountry = { country_code: string; country_name: string; visits: number };
type DemoRevenue = { source_key: string; source_label: string; amount_cents: number };

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function PublisherDemoTutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    ["Bem-vindo à demonstração", "Esta é uma conta de demonstração para editoras. Os números, vendas, valores e acessos exibidos aqui são fictícios e ficam isolados dos dados oficiais da plataforma."],
    ["Dashboard", "Use o Dashboard para acompanhar obras, arquivos publicados, vendas, receita e desempenho. Nesta conta, os indicadores são preenchidos com dados de exemplo para mostrar como a área funciona."],
    ["Estúdio", "No Estúdio você cria e administra obras, capas, arquivos, volumes, capítulos, idiomas e configurações de publicação. É a principal área de trabalho editorial."],
    ["Biblioteca", "A Biblioteca reúne as publicações disponíveis para a conta e permite visualizar e organizar o conteúdo digital."],
    ["Gestão editorial", "A Gestão editorial concentra recursos voltados à operação da editora e ao acompanhamento do conteúdo publicado."],
    ["Visitantes por país", "O gráfico de países ainda está em planejamento e desenvolvimento. Os países e acessos desta demonstração são apenas exemplos visuais e não representam analytics reais."],
    ["Dados de demonstração", "Você pode explorar a conta livremente. Os dados mockados desta conta não são enviados para vendas, obras, compras ou métricas oficiais do sistema."],
  ];
  const [title, text] = steps[step];
  return <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-[.18em] text-primary">Tutorial para editoras · {step + 1}/{steps.length}</span><h2 className="mt-2 font-display text-2xl">{title}</h2></div><button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Fechar tutorial"><X className="size-4" /></button></div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{text}</p>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${((step+1)/steps.length)*100}%`}} /></div>
      <div className="mt-5 flex justify-between gap-3"><Button variant="outline" disabled={step===0} onClick={()=>setStep(v=>Math.max(0,v-1))}>Voltar</Button>{step < steps.length-1 ? <Button onClick={()=>setStep(v=>v+1)}>Próximo</Button> : <Button onClick={onClose}>Explorar sistema</Button>}</div>
    </div>
  </div>;
}

function DemoStudioDashboard({ userId }: { userId: string }) {
  const demo = useQuery({
    queryKey: ["publisher-demo-dashboard", userId],
    queryFn: async () => {
      const [metrics, access, countries, revenue] = await Promise.all([
        db.from("demo_dashboard").select("metric_key,metric_label,metric_value").eq("user_id", userId),
        db.from("demo_dashboard_access").select("month_number,unique_visitors,visits,page_views").eq("user_id", userId).order("month_number"),
        db.from("demo_dashboard_countries").select("country_code,country_name,visits").eq("user_id", userId).order("visits", { ascending: false }),
        db.from("demo_dashboard_revenue").select("source_key,source_label,amount_cents").eq("user_id", userId),
      ]);
      for (const result of [metrics, access, countries, revenue]) if (result.error) throw result.error;
      return { metrics: (metrics.data ?? []) as DemoMetric[], access: (access.data ?? []) as DemoAccess[], countries: (countries.data ?? []) as DemoCountry[], revenue: (revenue.data ?? []) as DemoRevenue[] };
    },
  });
  const metric = (key:string) => Number(demo.data?.metrics.find(x=>x.metric_key===key)?.metric_value ?? 0);
  const accessData=(demo.data?.access??[]).map(x=>({month:MONTHS[x.month_number-1]??String(x.month_number), visitantes:x.unique_visitors, visitas:x.visits, visualizacoes:x.page_views}));
  const revenueData=(demo.data?.revenue??[])
    .filter((x)=>x.source_key !== "marketplace")
    .map((x,i)=>({name:x.source_label,value:x.amount_cents,fill:chartColors[i%chartColors.length]}));
  const revenueTotal=revenueData.reduce((a,b)=>a+b.value,0);
  const countryTotal=(demo.data?.countries??[]).reduce((a,b)=>a+b.visits,0);
  if (demo.isPending) return <section className="py-16 text-center text-sm text-muted-foreground">Carregando demonstração…</section>;
  if (demo.isError) return <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6"><h2 className="font-semibold">Não foi possível carregar os dados demonstrativos.</h2><p className="mt-1 text-sm text-muted-foreground">Confira se as tabelas demo_* e as políticas RLS foram criadas no Supabase.</p></section>;
  return <section className="space-y-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-3 lg:space-y-0" data-demo-dashboard>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3"><div><strong className="text-sm">Conta de demonstração</strong><p className="text-xs text-muted-foreground">Dados fictícios e isolados das métricas oficiais.</p></div><Button variant="outline" size="sm" onClick={startPublisherDemoTour}><HelpCircle className="mr-2 size-4"/>Ver tutorial</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Obras",metric("works"),"Cadastradas pela editora"],["Arquivos publicados",metric("published_files"),"Volumes/capítulos publicados"],["Vendas",metric("sales"),"Vendas registradas"],["Receita",formatMarketplacePrice(metric("revenue")*100,"BRL"),"Bruta, antes de taxas"]].map(([label,value,sub])=><div key={String(label)} className="ink-panel rounded-2xl p-5"><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block text-2xl">{typeof value==='number'?formatNumber(value):value}</strong><span className="text-xs text-muted-foreground">{sub}</span></div>)}
    </div>
    <section className="ink-panel rounded-2xl p-4 lg:min-h-0 lg:flex-[1.05]"><div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold">Visitas e visualizações</h3><p className="text-xs text-muted-foreground">Evolução demonstrativa ao longo do ano.</p></div><span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Dados demo</span></div><div className="mt-3 h-[260px] lg:h-[calc(100%-3.4rem)] lg:min-h-[180px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={accessData}><defs><linearGradient id="demoPage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-chart-1)" stopOpacity=".7"/><stop offset="1" stopColor="var(--color-chart-1)" stopOpacity=".03"/></linearGradient><linearGradient id="demoVisits" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-chart-2)" stopOpacity=".55"/><stop offset="1" stopColor="var(--color-chart-2)" stopOpacity=".03"/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--color-border)"/><XAxis dataKey="month"/><YAxis/><Tooltip contentStyle={tooltipStyle}/><Area type="monotone" dataKey="visualizacoes" name="Visualizações" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#demoPage)"/><Area type="monotone" dataKey="visitas" name="Visitas" stroke="var(--color-chart-2)" strokeWidth={2.5} fill="url(#demoVisits)"/><Area type="monotone" dataKey="visitantes" name="Visitantes únicos" stroke="var(--color-chart-3)" strokeWidth={2} fillOpacity={0}/></AreaChart></ResponsiveContainer></div></section>
    <div className="grid gap-3 xl:grid-cols-2 lg:min-h-0 lg:flex-1">
      <section className="ink-panel flex min-h-0 flex-col rounded-2xl p-4"><h3 className="text-lg font-semibold">Valores</h3><p className="text-xs text-muted-foreground">Receita demonstrativa por canal.</p><div className="mt-2 grid min-h-0 flex-1 items-stretch gap-3 sm:grid-cols-[minmax(220px,0.95fr)_1.05fr]"><div className="relative mx-auto aspect-square h-full min-h-[220px] max-h-full w-full max-w-[420px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={revenueData} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="94%" paddingAngle={2} stroke="none">{revenueData.map(x=><Cell key={x.name} fill={x.fill}/>)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v)=>[formatMarketplacePrice(Number(v),"BRL"),"Receita"]}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><span className="text-[11px] text-muted-foreground">Total</span><strong className="text-xl sm:text-2xl">{formatMarketplacePrice(revenueTotal,"BRL")}</strong></div></div><div className="flex flex-col justify-center gap-3">{revenueData.map(x=><div key={x.name}><div className="flex justify-between text-sm"><span>{x.name}</span><strong>{formatMarketplacePrice(x.value,"BRL")}</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{width:`${revenueTotal?x.value/revenueTotal*100:0}%`,background:x.fill}}/></div></div>)}</div></div></section>
      <section className="ink-panel min-h-0 overflow-hidden rounded-2xl p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Visitantes por país</h3><p className="text-xs text-muted-foreground">Distribuição geográfica demonstrativa dos acessos.</p></div><Globe2 className="size-5 text-primary"/></div><div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground"><strong className="text-foreground">Em planejamento e desenvolvimento.</strong> Estes dados são fictícios e servem somente para demonstrar como o recurso poderá funcionar.</div><div className="mt-2 grid gap-1.5">{(demo.data?.countries??[]).map((c,i)=>{const pct=countryTotal?c.visits/countryTotal*100:0;return <div key={c.country_code} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-xl border border-border/50 bg-background/25 px-3 py-1.5"><span className="text-xs font-bold text-primary">{c.country_code}</span><div><div className="flex justify-between gap-3 text-sm"><span>{c.country_name}</span><span className="text-muted-foreground">{pct.toFixed(1)}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${pct}%`}}/></div></div><strong className="text-sm">{formatNumber(c.visits)}</strong></div>})}</div></section>
    </div>
  </section>;
}

export function StudioDashboard({ userId }: { userId: string }) {
  const account = useQuery({queryKey:["demo-account",userId],queryFn:async()=>{const {data,error}=await db.from("demo_accounts").select("enabled,tutorial_enabled").eq("user_id",userId).maybeSingle();if(error) throw error;return data as {enabled:boolean;tutorial_enabled:boolean}|null;}});
  if (account.isPending) return <section className="py-16 text-center text-sm text-muted-foreground">Carregando dashboard…</section>;
  if (account.data?.enabled) return <DemoStudioDashboard userId={userId}/>;
  return <RealStudioDashboard userId={userId}/>;
}

