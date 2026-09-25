import { Route } from "@/routes/compras";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Loader2,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PublicationCover } from "@/components/PublicationCover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createMarketplaceCheckout, formatMarketplacePrice } from "@/lib/marketplace";
import { getStripeEnvironment } from "@/lib/stripe";

const db = supabase as any;

type OrderRow = {
  id: string;
  seller_id: string;
  status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  stripe_environment: "sandbox" | "live";
  paid_at: string | null;
  created_at: string;
};
type ItemRow = { id: string; order_id: string; title: string; author: string; cover_url: string | null; work_type: string; price_cents: number; currency: string; target_type: string; manga_ids: string[] };
type DeliveryRow = { code: string; order_id: string; order_item_id: string; title: string; used_at: string | null; created_at: string };
type ProfileMini = { id: string; display_name: string; avatar_url: string | null };
type RefundRow = { id: string; order_id: string; reason: string; status: string; resolution_note: string; requested_at: string };

export function PurchasesPage() {
  const { user, loading } = useAuth();
  const environment = getStripeEnvironment();
  const queryClient = useQueryClient();
  const [refundOrder, setRefundOrder] = useState<OrderRow | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundDetails, setRefundDetails] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["my-marketplace-orders", user?.id, environment],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_orders")
        .select("id,seller_id,status,fulfillment_status,total_cents,currency,stripe_environment,paid_at,created_at")
        .eq("buyer_id", user!.id)
        .eq("stripe_environment", environment)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const orderIds = useMemo(() => ordersQuery.data?.map((o) => o.id) ?? [], [ordersQuery.data]);
  const sellerIds = useMemo(() => Array.from(new Set((ordersQuery.data ?? []).map((o) => o.seller_id))), [ordersQuery.data]);

  const itemsQuery = useQuery({
    queryKey: ["my-marketplace-order-items", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_order_items").select("id,order_id,title,author,cover_url,work_type,price_cents,currency,target_type,manga_ids").in("order_id", orderIds).order("created_at");
      if (error) throw error;
      return (data ?? []) as ItemRow[];
    },
  });

  const deliveryQuery = useQuery({
    queryKey: ["my-marketplace-deliveries", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_delivery_codes").select("code,order_id,order_item_id,title,used_at,created_at").in("order_id", orderIds).order("created_at");
      if (error) throw error;
      return (data ?? []) as DeliveryRow[];
    },
  });

  const sellersQuery = useQuery({
    queryKey: ["my-marketplace-sellers", sellerIds.join(",")],
    enabled: sellerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("id,display_name,avatar_url").in("id", sellerIds);
      if (error) throw error;
      return (data ?? []) as ProfileMini[];
    },
  });

  const refundsQuery = useQuery({
    queryKey: ["my-marketplace-refunds", user?.id, orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("marketplace_refund_requests").select("id,order_id,reason,status,resolution_note,requested_at").in("order_id", orderIds).order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RefundRow[];
    },
  });

  const redeemAll = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await db.rpc("redeem_marketplace_order", { _order_id: orderId });
      if (error) throw error;
      return data as { codes?: number; files?: number };
    },
    onSuccess: (data) => {
      void deliveryQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["personal-library"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      toast.success(`Importação concluída${data?.files ? `: ${data.files} arquivo(s)` : ""}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payOrder = useMutation({
    mutationFn: createMarketplaceCheckout,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error: Error) => toast.error(error.message),
  });

  const requestRefund = useMutation({
    mutationFn: async () => {
      if (!refundOrder) throw new Error("Pedido inválido.");
      const { error } = await db.rpc("request_marketplace_refund", {
        _order_id: refundOrder.id,
        _reason: refundReason.trim(),
        _details: refundDetails.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRefundOrder(null);
      setRefundReason("");
      setRefundDetails("");
      void refundsQuery.refetch();
      toast.success("Solicitação de reembolso enviada para análise");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading) return <main className="mx-auto grid min-h-[55vh] max-w-5xl place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></main>;
  if (!user) return <main className="mx-auto max-w-lg px-4 py-20 text-center"><ShoppingBag className="mx-auto size-9 text-primary" /><h1 className="mt-4 font-display text-3xl">Suas compras ficam aqui</h1><p className="mt-2 text-sm text-muted-foreground">Entre para acompanhar pedidos, importar arquivos e solicitar suporte.</p><Button asChild className="mt-6"><Link to="/auth">Entrar</Link></Button></main>;

  const itemsByOrder = new Map<string, ItemRow[]>();
  for (const item of itemsQuery.data ?? []) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  const deliveriesByOrder = new Map<string, DeliveryRow[]>();
  for (const code of deliveryQuery.data ?? []) deliveriesByOrder.set(code.order_id, [...(deliveriesByOrder.get(code.order_id) ?? []), code]);
  const sellerMap = new Map((sellersQuery.data ?? []).map((seller) => [seller.id, seller]));
  const refundByOrder = new Map<string, RefundRow>();
  for (const refund of refundsQuery.data ?? []) if (!refundByOrder.has(refund.order_id)) refundByOrder.set(refund.order_id, refund);

  const loadingData = ordersQuery.isLoading || itemsQuery.isLoading || deliveryQuery.isLoading;

  return (
    <main className="w-full px-3 pb-24 pt-4 sm:px-5 sm:pt-8 lg:px-8">
      <section className="rounded-[1.75rem] border border-border/70 bg-card/70 p-5 sm:p-8 lg:p-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><ReceiptText className="size-3.5" /> Histórico</div><h1 className="mt-4 font-display text-3xl sm:text-4xl">Minhas compras</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Acompanhe pagamentos, códigos de entrega e a importação dos itens para sua biblioteca.</p></div>
          <Button asChild variant="outline" className="rounded-xl"><Link to="/marketplace"><ShoppingBag className="size-4" /> Continuar comprando</Link></Button>
        </div>
      </section>

      {loadingData ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div> : ordersQuery.data?.length ? (
        <div className="mt-5 grid gap-4">
          {ordersQuery.data.map((order) => {
            const seller = sellerMap.get(order.seller_id);
            const items = itemsByOrder.get(order.id) ?? [];
            const deliveries = deliveriesByOrder.get(order.id) ?? [];
            const unusedCodes = deliveries.filter((delivery) => !delivery.used_at);
            const refund = refundByOrder.get(order.id);
            const canPay = ["pending", "awaiting_payment", "expired"].includes(order.status);
            const paid = order.status === "paid";
            return (
              <article key={order.id} className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/55">
                <div className="flex flex-col gap-4 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-10 shrink-0"><AvatarImage src={seller?.avatar_url ?? undefined} /><AvatarFallback>{seller?.display_name?.slice(0, 1)?.toUpperCase() || "V"}</AvatarFallback></Avatar>
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{seller?.display_name || "Vendedor"}</p><OrderBadge status={order.status} fulfillment={order.fulfillment_status} /></div><p className="mt-0.5 text-[11px] text-muted-foreground">Pedido #{order.id.slice(0, 8).toUpperCase()} • {formatDate(order.created_at)}</p></div>
                  </div>
                  <strong className="text-lg">{formatMarketplacePrice(order.total_cents, order.currency)}</strong>
                </div>

                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="grid gap-2.5">
                    {items.map((item) => {
                      const code = deliveries.find((delivery) => delivery.order_item_id === item.id);
                      return <div key={item.id} className="flex gap-3 rounded-xl border border-border/60 bg-background/30 p-3"><div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted/50"><PublicationCover coverUrl={item.cover_url} workType={item.work_type} title={item.title} className="h-full w-full object-cover" fallback={<BookOpenCheck className="m-auto mt-4 size-5 text-muted-foreground" />} /></div><div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.author || "Publicação digital"}</p>{code ? <div className="mt-2 flex min-w-0 items-center gap-2"><code className="min-w-0 truncate rounded-md bg-muted/60 px-2 py-1 text-[11px]">{code.code}</code><button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => void navigator.clipboard.writeText(code.code).then(() => toast.success("Código copiado"))}><Copy className="size-3.5" /></button>{code.used_at ? <Badge variant="outline">Importado</Badge> : null}</div> : paid ? <p className="mt-2 text-[11px] text-muted-foreground">Aguardando geração do código…</p> : null}</div><span className="shrink-0 text-xs font-semibold">{formatMarketplacePrice(item.price_cents, item.currency)}</span></div>;
                    })}
                  </div>

                  <aside className="rounded-xl border border-border/60 bg-background/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Ações do pedido</p>
                    <div className="mt-3 grid gap-2">
                      {canPay ? <Button className="rounded-xl" disabled={payOrder.isPending} onClick={() => payOrder.mutate(order.id)}>{payOrder.isPending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Pagar pedido</Button> : null}
                      {paid && unusedCodes.length > 0 ? <Button className="rounded-xl" disabled={redeemAll.isPending} onClick={() => redeemAll.mutate(order.id)}>{redeemAll.isPending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />} Importar todos</Button> : null}
                      {paid && deliveries.length > 0 && unusedCodes.length === 0 ? <Button asChild className="rounded-xl"><Link to="/biblioteca"><BookOpenCheck className="size-4" /> Abrir biblioteca</Link></Button> : null}
                      <Button asChild variant="outline" className="rounded-xl"><Link to="/social" search={{ friend: order.seller_id, order: order.id, payment: "" }}><MessageCircle className="size-4" /> Abrir conversa</Link></Button>
                      {paid && !refund ? <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={() => setRefundOrder(order)}><RotateCcw className="size-4" /> Solicitar reembolso</Button> : null}
                    </div>
                    {refund ? <div className="mt-3 rounded-lg border border-border/65 bg-card/45 p-3"><p className="text-xs font-semibold">Reembolso: {refundStatusLabel(refund.status)}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{refund.resolution_note || `Solicitado em ${formatDate(refund.requested_at)}.`}</p></div> : null}
                  </aside>
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="mt-5 rounded-[1.5rem] border border-dashed border-border/70 py-20 text-center"><ShoppingBag className="mx-auto size-9 text-muted-foreground" /><h2 className="mt-4 font-display text-2xl">Nenhuma compra ainda</h2><p className="mt-2 text-sm text-muted-foreground">Seus pedidos do Marketplace aparecerão aqui.</p><Button asChild className="mt-5"><Link to="/marketplace">Explorar Marketplace</Link></Button></div>}

      <Dialog open={!!refundOrder} onOpenChange={(open) => !open && setRefundOrder(null)}>
        <DialogContent className="max-w-lg rounded-[1.35rem]">
          <DialogHeader><DialogTitle>Solicitar reembolso</DialogTitle><DialogDescription>A solicitação será vinculada ao pedido e enviada para análise. Isso não executa um estorno automaticamente.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><label className="text-sm font-medium">Motivo</label><Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Ex.: arquivo incorreto ou problema de acesso" maxLength={120} /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Detalhes</label><Textarea value={refundDetails} onChange={(e) => setRefundDetails(e.target.value)} rows={5} maxLength={3000} placeholder="Explique o problema e o que já tentou fazer." /></div>
            <Button className="w-full rounded-xl" disabled={requestRefund.isPending || refundReason.trim().length < 3} onClick={() => requestRefund.mutate()}>{requestRefund.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Enviar solicitação</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function OrderBadge({ status, fulfillment }: { status: string; fulfillment: string }) { if (status === "paid") return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">{fulfillment === "delivered" ? <><CheckCircle2 className="mr-1 size-3" /> Pago e entregue</> : "Pago"}</Badge>; if (status === "refunded") return <Badge variant="outline">Reembolsado</Badge>; if (status === "awaiting_payment") return <Badge variant="outline"><Clock3 className="mr-1 size-3" /> Aguardando pagamento</Badge>; if (status === "expired") return <Badge variant="outline">Checkout expirado</Badge>; if (status === "canceled") return <Badge variant="outline">Cancelado</Badge>; return <Badge variant="outline">Pedido criado</Badge>; }
function refundStatusLabel(status: string) { if (status === "requested") return "Solicitado"; if (status === "under_review") return "Em análise"; if (status === "approved") return "Aprovado para processamento"; if (status === "rejected") return "Não aprovado"; return "Resolvido"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
