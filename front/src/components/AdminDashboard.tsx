import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatMarketplacePrice } from "@/lib/marketplace";
import { formatNumber } from "@/lib/numberFormat";
import { WORK_TYPES } from "@/lib/publication";

type Dashboard = {
  users: { total: number; plus: number; free: number };
  works: Array<{ type: string; count: number }>;
  access: {
    total: number;
    uniqueUsers: number;
    days: Array<{ date: string; sessions: number; users: number }>;
  };
  updatedAt: string;
};

const db = supabase as any;
const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};
const typeColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function AdminDashboard() {
  const [days, setDays] = useState(30);
  const q = useQuery({
    queryKey: ["admin-dashboard", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_dashboard", { _days: days });
      if (error) throw error;
      return data as unknown as Dashboard;
    },
    staleTime: 60_000,
  });
  const money = useQuery({
    queryKey: ["admin-dashboard-money", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const [p, m] = await Promise.all([
        db.from("purchases").select("amount_cents,status,created_at").gte("created_at", since.toISOString()).limit(5000),
        db.from("marketplace_orders").select("total_cents,status,created_at").gte("created_at", since.toISOString()).limit(5000),
      ]);
      const rows = [...(p.data ?? []), ...(m.data ?? [])].filter((x: any) => x.status === "paid");
      return { sold: rows.reduce((total: number, row: any) => total + Number(row.amount_cents ?? row.total_cents ?? 0), 0) };
    },
    staleTime: 60_000,
  });

  const data = q.data;
  const works = (data?.works ?? []).map((item, index) => ({
    ...item,
    label: WORK_TYPES.find((type) => type.value === item.type)?.label ?? item.type,
    fill: typeColors[index % typeColors.length],
  }));
  const totalWorks = works.reduce((total, item) => total + item.count, 0);
  const totalUsers = data?.users.total ?? 0;
  const planData = [
    { name: "Grátis", value: data?.users.free ?? 0, fill: "#74E6B3" },
    { name: "Plus", value: data?.users.plus ?? 0, fill: "#7C6CF2" },
  ];
  const accessDays = data?.access.days ?? [];
  const periodLabel = days === 90 ? "3 meses" : `${days} dias`;

  const downloadReport = () => {
    const rows = [["Data", "Acessos", "Usuarios"], ...accessDays.map((item) => [item.date, item.sessions, item.users])];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `booksyde-admin-${days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="min-w-0 space-y-4 sm:space-y-5" aria-label="Dashboard administrativo">
      <div className="flex items-end justify-between gap-3 sm:justify-end">
        <div className="sm:hidden">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Administração</p>
          <h1 className="font-display text-2xl leading-tight">Dashboard</h1>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <select
            aria-label="Período do dashboard"
            className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-2.5 text-xs sm:flex-none sm:px-3 sm:text-sm"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>3 meses</option>
          </select>
          <Button className="hidden sm:inline-flex" variant="outline" size="icon" title="Baixar relatório" aria-label="Baixar relatório" onClick={downloadReport}>
            <Download className="size-4" />
          </Button>
          <Button variant="outline" size="icon" title="Atualizar" aria-label="Atualizar" onClick={() => { void q.refetch(); void money.refetch(); }}>
            <RefreshCw className={q.isFetching ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>

      {q.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm sm:p-5">
          Não foi possível carregar os dados administrativos. Confirme a migration <code>get_admin_dashboard</code> no Supabase.
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
            <Metric icon={Eye} title="Valor vendido" value={formatMarketplacePrice(money.data?.sold ?? 0)} tone="emerald" sub={`Últimos ${periodLabel}`} />
            <Metric icon={WalletCards} title="Gasto com editoras" value="—" tone="amber" sub="Repasses em preparação" />
            <Link
              to="/admin/contratos"
              className="col-span-2 flex min-h-[88px] items-center gap-3 rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/10 to-card p-3.5 transition hover:-translate-y-0.5 sm:p-5 lg:col-span-1"
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-400/15 sm:size-14 sm:rounded-2xl">
                <FileText className="size-5 sm:size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Contratos</p>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Gerencie contratos das editoras.</p>
              </div>
              <ChevronRight className="size-4 shrink-0 sm:size-5" />
            </Link>
          </div>

          <section className="rounded-2xl border border-border/70 bg-card/60 p-3.5 sm:p-5">
            <div className="mb-3 flex items-center gap-2.5 sm:mb-5 sm:gap-3">
              <div className="grid size-9 place-items-center rounded-xl border sm:size-10"><Users className="size-4 sm:size-5" /></div>
              <div className="min-w-0">
                <h2 className="font-semibold">Tipos de usuários</h2>
                <p className="hidden text-xs text-muted-foreground sm:block">Distribuição e evolução dos usuários da plataforma.</p>
              </div>
            </div>

            <div className="grid items-center gap-4 xl:grid-cols-[.72fr_1.28fr] xl:gap-6">
              <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[220px_1fr] sm:gap-4">
                <div className="relative h-[132px] sm:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={planData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" stroke="none" isAnimationActive={false}>
                        {planData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <strong className="text-xl sm:text-3xl">{formatNumber(totalUsers)}</strong>
                      <p className="text-[10px] text-muted-foreground sm:text-xs">usuários</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {planData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-2 border-b pb-2 text-xs sm:pb-3 sm:text-sm">
                      <span className="flex min-w-0 items-center gap-2"><i className="size-2.5 shrink-0 rounded-full" style={{ background: item.fill }} />{item.name}</span>
                      <strong className="shrink-0">{formatNumber(item.value)} <span className="hidden text-xs font-normal text-muted-foreground sm:inline">({totalUsers ? Math.round(item.value / totalUsers * 100) : 0}%)</span></strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden h-[240px] min-w-0 sm:block sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={accessDays.map((day) => ({
                    ...day,
                    free: totalUsers ? day.users * ((data.users.free ?? 0) / totalUsers) : 0,
                    plus: totalUsers ? day.users * ((data.users.plus ?? 0) / totalUsers) : 0,
                  }))} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminFree" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#74E6B3" stopOpacity=".28" /><stop offset="1" stopColor="#74E6B3" stopOpacity="0" /></linearGradient>
                      <linearGradient id="adminPlus" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7C6CF2" stopOpacity=".22" /><stop offset="1" stopColor="#7C6CF2" stopOpacity="0" /></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeOpacity={0.35} />
                    <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5).split("-").reverse().join("/")} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area dataKey="free" name="Grátis" type="monotone" stroke="#74E6B3" fill="url(#adminFree)" strokeWidth={2.5} />
                    <Area dataKey="plus" name="Plus" type="monotone" stroke="#7C6CF2" fill="url(#adminPlus)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:gap-5 xl:grid-cols-2">
            <section className="flex flex-col rounded-2xl border border-border/70 bg-card/60 p-3.5 sm:min-h-[330px] sm:p-5">
              <div className="mb-3 flex items-center gap-2.5 sm:mb-4 sm:gap-3">
                <BookOpen className="size-4 sm:size-5" />
                <div><h2 className="font-semibold">Quantidade de arquivos</h2><p className="hidden text-xs text-muted-foreground sm:block">Total de obras cadastradas por tipo.</p></div>
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:justify-evenly sm:gap-3">
                {works.map((item, index) => {
                  const pct = totalWorks ? item.count / totalWorks * 100 : 0;
                  return (
                    <div key={item.type} className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:min-h-12 sm:grid-cols-[90px_48px_1fr] sm:gap-3">
                      <span className="truncate">{item.label}</span>
                      <strong>{formatNumber(item.count)}</strong>
                      <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted sm:col-span-1 sm:h-2.5">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: typeColors[index % typeColors.length] }} />
                      </div>
                    </div>
                  );
                })}
                {!works.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma obra cadastrada.</p> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card/60 p-3.5 sm:p-5">
              <div className="mb-3 sm:mb-4"><h2 className="font-semibold">Informações do sistema</h2><p className="hidden text-xs text-muted-foreground sm:block">Indicadores gerais da plataforma.</p></div>
              <div className="grid gap-2 sm:space-y-3">
                <SystemRow icon={Eye} label="Acessos" value={data.access.total} />
                <SystemRow icon={Users} label="Contas criadas" value={data.users.total} />
                <SystemRow icon={BookOpen} label="Livros publicados" value={totalWorks} />
              </div>
            </section>
          </div>
        </>
      ) : q.isPending ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted sm:h-32" />)}</div>
      ) : null}
    </section>
  );
}

function Metric({ icon: Icon, title, value, sub, tone }: { icon: any; title: string; value: string; sub: string; tone: "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "border-emerald-400/20 from-emerald-500/10" : "border-amber-400/20 from-amber-500/10";
  return (
    <div className={`min-w-0 rounded-2xl border bg-gradient-to-br ${cls} to-card p-3 sm:p-5`}>
      <div className="flex min-w-0 items-start gap-2.5 sm:items-center sm:gap-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground/5 sm:size-14 sm:rounded-2xl"><Icon className="size-4 sm:size-7" /></div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold sm:text-sm">{title}</p>
          <p className="truncate font-display text-xl font-semibold sm:text-3xl">{value}</p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function SystemRow({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background/30 p-3 sm:gap-4 sm:p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 sm:size-11 sm:rounded-xl"><Icon className="size-4 text-primary sm:size-5" /></div>
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground sm:text-sm">{label}</p><strong className="text-xl tabular-nums sm:text-2xl">{formatNumber(value)}</strong></div>
    </div>
  );
}
