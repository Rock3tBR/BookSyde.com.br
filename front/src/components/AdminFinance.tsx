import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ManagementNavigation } from "@/components/ManagementNavigation";
import { ManagementNotice } from "@/components/ManagementNotice";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatMarketplacePrice } from "@/lib/marketplace";

type FinancialOrder = { id: string; seller_id: string; total_cents: number; currency: string; status: string; stripe_environment: string; created_at: string };
const db = supabase as any;
export function AdminFinance() {
  const { user, loading } = useAuth();
  const { data: admin, isLoading } = useIsAdmin();
  const [environment, setEnvironment] = useState<"live" | "sandbox">("live");
  const orders = useQuery({
    queryKey: ["admin-financial-orders", environment],
    enabled: !!user && !!admin,
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_orders")
        .select("id,seller_id,total_cents,currency,status,stripe_environment,created_at")
        .eq("stripe_environment", environment).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as FinancialOrder[];
    },
  });
  if (loading || isLoading) return <main className="p-8">Verificando acesso…</main>;
  if (!user || !admin) return <main className="p-8">Área exclusiva da administração.</main>;
  const paid = (orders.data ?? []).filter((order) => order.status === "paid");
  const gross = paid.reduce((sum, order) => sum + order.total_cents, 0);
  return <ManagementNavigation area="admin"><div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-primary">Administração</p><h1 className="font-display text-3xl">Financeiro</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhamento operacional de pedidos. Não equivale a lucro nem saldo Stripe.</p></div>
      <div className="flex gap-2" role="group" aria-label="Ambiente Stripe"><Button size="sm" variant={environment === "live" ? "default" : "outline"} onClick={() => setEnvironment("live")}>Produção</Button><Button size="sm" variant={environment === "sandbox" ? "default" : "outline"} onClick={() => setEnvironment("sandbox")}>Sandbox</Button></div></div>
    <Badge variant="outline">{environment === "live" ? "Produção" : "Dados de teste"}</Badge>
    {orders.isError ? <ManagementNotice title="Não foi possível consultar pedidos" description="Verifique sua sessão, a política de acesso do Supabase e tente novamente. Não serão exibidos números fictícios." /> : null}
    {orders.isSuccess ? <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border bg-card/65 p-5"><p className="text-xs text-muted-foreground">Vendas pagas do Marketplace*</p><p className="mt-3 font-display text-2xl">{formatMarketplacePrice(gross)}</p></div>
      <div className="rounded-2xl border bg-card/65 p-5"><p className="text-xs text-muted-foreground">Pedidos pagos*</p><p className="mt-3 font-display text-2xl">{paid.length}</p></div>
      <div className="rounded-2xl border bg-card/65 p-5"><p className="text-xs text-muted-foreground">Pedidos pendentes*</p><p className="mt-3 font-display text-2xl">{orders.data.filter(o => o.status === "pending" || o.status === "awaiting_payment").length}</p></div>
    </section> : <p className="text-sm text-muted-foreground">Consultando pedidos…</p>}
    <ManagementNotice title="Conciliação e royalties ainda não integrados" description="Os números acima são apenas valores brutos dos últimos 500 pedidos no ambiente selecionado. Assinaturas, vendas diretas, taxas, impostos, estornos, comissões, royalties e repasses ainda precisam de um extrato financeiro auditável para calcular receita própria, margem e saldo disponível. Não trate este total como lucro." />
    {orders.isSuccess ? <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/55 p-4"><h2 className="font-display text-xl">Últimos pedidos</h2><div className="mt-3 space-y-2">{orders.data.slice(0,25).map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/65 px-3 py-2 text-sm"><span className="min-w-0 break-all">#{o.id.slice(0,8)} · {new Date(o.created_at).toLocaleDateString("pt-BR")} · {o.status}</span><strong>{formatMarketplacePrice(o.total_cents,o.currency)}</strong></div>)}{!orders.data.length ? <p className="text-sm text-muted-foreground">Nenhum pedido neste ambiente.</p> : null}</div><p className="mt-3 text-xs text-muted-foreground">*Amostra dos últimos 500 pedidos, sem somar outras fontes de receita.</p></section> : null}
  </div></ManagementNavigation>;
}
