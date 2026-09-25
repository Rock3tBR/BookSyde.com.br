import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  FileWarning,
  Headphones,
  Loader2,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  ShieldBan,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Children, type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

import { PublicationCover } from "@/components/PublicationCover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatMarketplacePrice } from "@/lib/marketplace";

const db = supabase as any;

type Seller = { user_id: string; featured: boolean; store_bio: string; suspended_at: string | null; suspension_reason: string | null; live_charges_enabled: boolean; sandbox_charges_enabled: boolean; created_at: string };
type Listing = { id: string; seller_id: string; title: string; cover_url: string | null; work_type: string; price_cents: number; currency: string; active: boolean; moderation_status: string; moderation_note: string | null; created_at: string };
type Order = { id: string; buyer_id: string; seller_id: string; status: string; total_cents: number; currency: string; stripe_environment: string; fulfillment_status: string; created_at: string };
type Report = { id: string; listing_id: string; seller_id: string; reporter_id: string; reason: string; details: string; status: string; resolution_note: string; created_at: string };
type Refund = { id: string; order_id: string; buyer_id: string; seller_id: string; reason: string; details: string; status: string; resolution_note: string; requested_at: string };
type Support = { id: string; user_id: string | null; name: string; email: string; topic: string; subject: string; message: string; status: string; created_at: string };
type Profile = { id: string; display_name: string; avatar_url: string | null };

export type MarketplaceAdminSection = "vendedores" | "anuncios" | "pedidos" | "denuncias" | "reembolsos" | "suporte";
export function MarketplaceAdminPanel({ section = "vendedores" }: { section?: MarketplaceAdminSection }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const sellersQuery = useQuery({
    queryKey: ["admin-marketplace-sellers"],
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_sellers").select("user_id,featured,store_bio,suspended_at,suspension_reason,live_charges_enabled,sandbox_charges_enabled,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
  const listingsQuery = useQuery({
    queryKey: ["admin-marketplace-listings"],
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_listings").select("id,seller_id,title,cover_url,work_type,price_cents,currency,active,moderation_status,moderation_note,created_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });
  const ordersQuery = useQuery({
    queryKey: ["admin-marketplace-orders"],
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_orders").select("id,buyer_id,seller_id,status,total_cents,currency,stripe_environment,fulfillment_status,created_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });
  const reportsQuery = useQuery({
    queryKey: ["admin-marketplace-reports"],
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_reports").select("id,listing_id,seller_id,reporter_id,reason,details,status,resolution_note,created_at").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as Report[];
    },
  });
  const refundsQuery = useQuery({
    queryKey: ["admin-marketplace-refunds"],
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_refund_requests").select("id,order_id,buyer_id,seller_id,reason,details,status,resolution_note,requested_at").order("requested_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as Refund[];
    },
  });
  const supportQuery = useQuery({
    queryKey: ["admin-support-requests"],
    queryFn: async () => {
      const { data, error } = await db.from("support_requests").select("id,user_id,name,email,topic,subject,message,status,created_at").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as Support[];
    },
  });

  const profileIds = useMemo(() => Array.from(new Set([
    ...(sellersQuery.data ?? []).map((x) => x.user_id),
    ...(ordersQuery.data ?? []).flatMap((x) => [x.buyer_id, x.seller_id]),
    ...(reportsQuery.data ?? []).flatMap((x) => [x.reporter_id, x.seller_id]),
    ...(refundsQuery.data ?? []).flatMap((x) => [x.buyer_id, x.seller_id]),
  ])), [sellersQuery.data, ordersQuery.data, reportsQuery.data, refundsQuery.data]);

  const profilesQuery = useQuery({
    queryKey: ["admin-marketplace-profiles", profileIds.join(",")],
    enabled: profileIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("id,display_name,avatar_url").in("id", profileIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const profileMap = new Map((profilesQuery.data ?? []).map((profile) => [profile.id, profile]));

  const adminAction = useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => {
      const { error } = await db.rpc(fn, args);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketplace"] });
      void sellersQuery.refetch(); void listingsQuery.refetch(); void reportsQuery.refetch(); void refundsQuery.refetch();
      toast.success("Marketplace atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshAll = () => {
    void Promise.all([sellersQuery.refetch(), listingsQuery.refetch(), ordersQuery.refetch(), reportsQuery.refetch(), refundsQuery.refetch(), supportQuery.refetch()]);
  };

  const paidOrders = (ordersQuery.data ?? []).filter((o) => o.status === "paid");
  const gross = paidOrders.reduce((sum, order) => sum + Number(order.total_cents), 0);
  const openReports = (reportsQuery.data ?? []).filter((r) => ["open", "reviewing"].includes(r.status)).length;
  const openRefunds = (refundsQuery.data ?? []).filter((r) => ["requested", "under_review", "approved"].includes(r.status)).length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Vendedores" value={String(sellersQuery.data?.length ?? 0)} />
        <Kpi icon={PackageOpen} label="Anúncios ativos" value={String((listingsQuery.data ?? []).filter((l) => l.active && l.moderation_status === "active").length)} />
        <Kpi icon={CircleDollarSign} label="Vendas pagas" value={formatMarketplacePrice(gross)} />
        <Kpi icon={AlertTriangle} label="Pendências" value={String(openReports + openRefunds)} />
      </div>

      <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-card/55 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><h2 className="font-display text-xl">Operação do Marketplace</h2><p className="text-xs text-muted-foreground">Modere anúncios e vendedores sem apagar o histórico financeiro dos pedidos.</p></div>
        <div className="flex gap-2"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, obra ou ID…" className="min-w-0 sm:w-64" /><Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={refreshAll}><RefreshCw className="size-4" /></Button></div>
      </div>

      <Tabs value={section}>


        <TabsContent value="vendedores" className="mt-4"><PanelList loading={sellersQuery.isLoading}>{filterSellers(sellersQuery.data ?? [], profileMap, search).map((seller) => { const profile = profileMap.get(seller.user_id); const suspended = !!seller.suspended_at; return <article key={seller.user_id} className="rounded-xl border border-border/65 bg-card/45 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><Avatar className="size-11"><AvatarImage src={profile?.avatar_url ?? undefined} /><AvatarFallback>{profile?.display_name?.slice(0,1)?.toUpperCase() || "V"}</AvatarFallback></Avatar><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{profile?.display_name || seller.user_id.slice(0,8)}</p>{seller.featured ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Destaque</Badge> : null}{suspended ? <Badge variant="destructive">Suspenso</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">Live: {seller.live_charges_enabled ? "recebendo" : "pendente"} • Sandbox: {seller.sandbox_charges_enabled ? "recebendo" : "pendente"}</p></div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => adminAction.mutate({ fn: "admin_set_marketplace_seller_featured", args: { _seller_id: seller.user_id, _featured: !seller.featured } })}>{seller.featured ? "Remover destaque" : <><BadgeCheck className="size-4" /> Destacar</>}</Button><Button size="sm" variant={suspended ? "outline" : "destructive"} onClick={() => { const reason = suspended ? "" : window.prompt("Motivo da suspensão:") ?? ""; if (!suspended && !reason.trim()) return; adminAction.mutate({ fn: "admin_set_marketplace_seller_suspension", args: { _seller_id: seller.user_id, _suspended: !suspended, _reason: reason } }); }}>{suspended ? "Reativar" : <><ShieldBan className="size-4" /> Suspender</>}</Button></div></div>{seller.suspension_reason ? <p className="mt-3 rounded-lg bg-destructive/8 p-2.5 text-xs text-muted-foreground">Motivo: {seller.suspension_reason}</p> : null}</article>; })}</PanelList></TabsContent>

        <TabsContent value="anuncios" className="mt-4"><PanelList loading={listingsQuery.isLoading}>{filterListings(listingsQuery.data ?? [], profileMap, search).map((listing) => { const seller = profileMap.get(listing.seller_id); return <article key={listing.id} className="flex flex-col gap-4 rounded-xl border border-border/65 bg-card/45 p-4 sm:flex-row sm:items-center"><div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted/50"><PublicationCover coverUrl={listing.cover_url} workType={listing.work_type} title={listing.title} className="h-full w-full object-cover" fallback={<Store className="m-auto mt-5 size-5 text-muted-foreground" />} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{listing.title}</p><ModerationBadge status={listing.moderation_status} active={listing.active} /></div><p className="mt-1 text-xs text-muted-foreground">{seller?.display_name || "Vendedor"} • {formatMarketplacePrice(listing.price_cents, listing.currency)}</p>{listing.moderation_note ? <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{listing.moderation_note}</p> : null}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => adminAction.mutate({ fn: "admin_set_marketplace_listing_status", args: { _listing_id: listing.id, _status: "under_review", _note: "Revisão manual iniciada pelo administrador." } })}>Revisar</Button>{listing.moderation_status === "removed" ? <Button size="sm" onClick={() => adminAction.mutate({ fn: "admin_set_marketplace_listing_status", args: { _listing_id: listing.id, _status: "active", _note: "" } })}>Restaurar</Button> : <Button size="sm" variant="destructive" onClick={() => { const note = window.prompt("Motivo da remoção:") ?? ""; if (!note.trim()) return; adminAction.mutate({ fn: "admin_set_marketplace_listing_status", args: { _listing_id: listing.id, _status: "removed", _note: note } }); }}>Remover</Button>}</div></article>; })}</PanelList></TabsContent>

        <TabsContent value="pedidos" className="mt-4"><PanelList loading={ordersQuery.isLoading}>{filterOrders(ordersQuery.data ?? [], profileMap, search).map((order) => <article key={order.id} className="rounded-xl border border-border/65 bg-card/45 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><OrderStatus status={order.status} /><span className="text-[11px] text-muted-foreground">#{order.id.slice(0,8).toUpperCase()}</span><Badge variant="outline">{order.stripe_environment}</Badge></div><p className="mt-2 text-xs text-muted-foreground">Comprador: {profileMap.get(order.buyer_id)?.display_name || order.buyer_id.slice(0,8)} • Vendedor: {profileMap.get(order.seller_id)?.display_name || order.seller_id.slice(0,8)}</p><p className="mt-1 text-[11px] text-muted-foreground">Entrega: {order.fulfillment_status}</p></div><strong>{formatMarketplacePrice(order.total_cents, order.currency)}</strong></div></article>)}</PanelList></TabsContent>

        <TabsContent value="denuncias" className="mt-4"><PanelList loading={reportsQuery.isLoading}>{(reportsQuery.data ?? []).map((report) => <ReviewCard key={report.id} icon={FileWarning} title={reportReason(report.reason)} status={report.status} subtitle={`Anúncio ${report.listing_id.slice(0,8)} • ${formatDate(report.created_at)}`} details={report.details || "Sem detalhes adicionais."} actions={<><Button size="sm" variant="outline" onClick={() => adminAction.mutate({ fn: "admin_review_marketplace_report", args: { _report_id: report.id, _status: "reviewing", _note: "" } })}>Em análise</Button><Button size="sm" onClick={() => adminAction.mutate({ fn: "admin_review_marketplace_report", args: { _report_id: report.id, _status: "resolved", _note: window.prompt("Nota da resolução:") ?? "" } })}>Resolver</Button><Button size="sm" variant="ghost" onClick={() => adminAction.mutate({ fn: "admin_review_marketplace_report", args: { _report_id: report.id, _status: "dismissed", _note: window.prompt("Motivo para descartar:") ?? "" } })}>Descartar</Button></>} />)}</PanelList></TabsContent>

        <TabsContent value="reembolsos" className="mt-4"><div className="mb-3 rounded-xl border border-primary/20 bg-primary/7 p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Importante:</strong> esta fila registra e modera solicitações. Marcar como “aprovado” não executa automaticamente um estorno na Stripe; o processamento financeiro deve ser confirmado antes de encerrar o caso.</div><PanelList loading={refundsQuery.isLoading}>{(refundsQuery.data ?? []).map((refund) => <ReviewCard key={refund.id} icon={RotateCcw} title={refund.reason} status={refund.status} subtitle={`Pedido #${refund.order_id.slice(0,8).toUpperCase()} • ${formatDate(refund.requested_at)}`} details={refund.details || "Sem detalhes adicionais."} actions={<><Button size="sm" variant="outline" onClick={() => adminAction.mutate({ fn: "admin_review_marketplace_refund", args: { _request_id: refund.id, _status: "under_review", _note: "" } })}>Em análise</Button><Button size="sm" onClick={() => adminAction.mutate({ fn: "admin_review_marketplace_refund", args: { _request_id: refund.id, _status: "approved", _note: window.prompt("Nota da aprovação:") ?? "" } })}>Aprovar análise</Button><Button size="sm" variant="destructive" onClick={() => adminAction.mutate({ fn: "admin_review_marketplace_refund", args: { _request_id: refund.id, _status: "rejected", _note: window.prompt("Motivo da rejeição:") ?? "" } })}>Rejeitar</Button></>} />)}</PanelList></TabsContent>

        <TabsContent value="suporte" className="mt-4"><PanelList loading={supportQuery.isLoading}>{(supportQuery.data ?? []).map((request) => <ReviewCard key={request.id} icon={Headphones} title={request.subject} status={request.status} subtitle={`${request.name} • ${request.email} • ${formatDate(request.created_at)}`} details={request.message} actions={<><Badge variant="outline">{request.topic}</Badge>{request.status === "open" ? <Button size="sm" variant="outline" onClick={() => adminAction.mutate({ fn: "admin_review_support_request", args: { _request_id: request.id, _status: "reviewing" } })}>Em análise</Button> : null}{request.status !== "resolved" && request.status !== "closed" ? <Button size="sm" onClick={() => adminAction.mutate({ fn: "admin_review_support_request", args: { _request_id: request.id, _status: "resolved" } })}>Resolver</Button> : null}</>} />)}</PanelList></TabsContent>
      </Tabs>
    </section>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) { return <div className="rounded-[1.2rem] border border-border/70 bg-card/55 p-4"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span></div><p className="mt-4 font-display text-2xl">{value}</p></div>; }
function PanelList({ loading, children }: { loading: boolean; children: ReactNode }) { if (loading) return <div className="grid min-h-48 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>; return <div className="grid gap-3">{Children.count(children) ? children : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum registro.</p>}</div>; }
function ReviewCard({ icon: Icon, title, subtitle, details, status, actions }: { icon: LucideIcon; title: string; subtitle: string; details: string; status: string; actions: ReactNode }) { return <article className="rounded-xl border border-border/65 bg-card/45 p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{title}</p><Badge variant="outline">{status}</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{details}</p><div className="mt-4 flex flex-wrap gap-2">{actions}</div></div></div></article>; }
function ModerationBadge({ status, active }: { status: string; active: boolean }) { if (status === "removed") return <Badge variant="destructive">Removido</Badge>; if (status === "under_review") return <Badge variant="outline">Em análise</Badge>; if (!active) return <Badge variant="outline">Inativo</Badge>; return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Ativo</Badge>; }
function OrderStatus({ status }: { status: string }) { if (status === "paid") return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Pago</Badge>; if (status === "refunded") return <Badge variant="outline">Reembolsado</Badge>; if (status === "awaiting_payment") return <Badge variant="outline">Aguardando</Badge>; return <Badge variant="outline">{status}</Badge>; }
function reportReason(reason: string) { return ({ copyright: "Direitos autorais", misleading: "Informações enganosas", illegal: "Conteúdo ilícito", spam: "Spam", other: "Outro" } as Record<string,string>)[reason] ?? reason; }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function norm(value: string) { return value.toLocaleLowerCase("pt-BR"); }
function filterSellers(rows: Seller[], profiles: Map<string,Profile>, search: string) { const s = norm(search.trim()); if (!s) return rows; return rows.filter((r) => norm(`${r.user_id} ${profiles.get(r.user_id)?.display_name ?? ""}`).includes(s)); }
function filterListings(rows: Listing[], profiles: Map<string,Profile>, search: string) { const s = norm(search.trim()); if (!s) return rows; return rows.filter((r) => norm(`${r.id} ${r.title} ${profiles.get(r.seller_id)?.display_name ?? ""}`).includes(s)); }
function filterOrders(rows: Order[], profiles: Map<string,Profile>, search: string) { const s = norm(search.trim()); if (!s) return rows; return rows.filter((r) => norm(`${r.id} ${profiles.get(r.seller_id)?.display_name ?? ""} ${profiles.get(r.buyer_id)?.display_name ?? ""}`).includes(s)); }
