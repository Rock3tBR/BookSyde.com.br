import { Route } from "@/routes/marketplace_.vendedor";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Loader2,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Store,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PublicationCover } from "@/components/PublicationCover";
import { ManagementNavigation } from "@/components/ManagementNavigation";
import { ManagementNotice } from "@/components/ManagementNotice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useIsSeller, useProfile } from "@/lib/auth";
import {
  formatMarketplacePrice,
  startMarketplaceSellerOnboarding,
  syncMarketplaceSellerStatus,
} from "@/lib/marketplace";
import { getStripeEnvironment } from "@/lib/stripe";

const db = supabase as any;

type SellerRow = {
  user_id: string;
  store_bio: string;
  suspended_at: string | null;
  suspension_reason: string | null;
  sandbox_charges_enabled: boolean;
  sandbox_payouts_enabled: boolean;
  sandbox_details_submitted: boolean;
  live_charges_enabled: boolean;
  live_payouts_enabled: boolean;
  live_details_submitted: boolean;
};

type ListingRow = {
  id: string;
  title: string;
  target_type: "manga" | "folder";
  cover_url: string | null;
  work_type: string;
  price_cents: number;
  currency: string;
  active: boolean;
  moderation_status: "active" | "under_review" | "removed";
  created_at: string;
};

type OrderRow = {
  id: string;
  buyer_id: string;
  status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
};

type OrderItemRow = {
  order_id: string;
  title: string;
  cover_url: string | null;
  work_type: string;
  price_cents: number;
};

type ProfileMini = { id: string; display_name: string; avatar_url: string | null };
type OwnFolder = { id: string; name: string; color: string };

export function SellerCenterPage({ section = "overview" }: { section?: "overview" | "orders" | "listings" | "finance" | "store" }) {
  const { user, loading } = useAuth();
  const { data: isSeller, isLoading: checkingSeller } = useIsSeller();
  const { data: isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const { data: profile } = useProfile();
  const connect = useRouterState({ select: (state) => ((state.location.search ?? {}) as Record<string, unknown>)["connect"] });
  const environment = getStripeEnvironment();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState("");
  const [folderId, setFolderId] = useState("");
  const [folderPrice, setFolderPrice] = useState("19,90");
  const handledConnectRef = useRef("");

  const sellerQuery = useQuery({
    queryKey: ["seller-center-profile", user?.id],
    enabled: !!user && (!!isSeller || !!isAdmin),
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_sellers")
        .select("user_id,store_bio,suspended_at,suspension_reason,sandbox_charges_enabled,sandbox_payouts_enabled,sandbox_details_submitted,live_charges_enabled,live_payouts_enabled,live_details_submitted")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SellerRow | null;
    },
  });

  useEffect(() => {
    setBio(sellerQuery.data?.store_bio ?? "");
  }, [sellerQuery.data?.store_bio]);

  const stripeStatusQuery = useQuery({
    queryKey: ["seller-center-stripe", user?.id, environment],
    enabled: !!user && (!!isSeller || !!isAdmin),
    retry: false,
    queryFn: syncMarketplaceSellerStatus,
  });

  useEffect(() => {
    if (!connect || !user || (!isSeller && !isAdmin)) return;
    if (handledConnectRef.current === `${user.id}:${connect}`) return;
    handledConnectRef.current = `${user.id}:${connect}`;

    if (connect === "refresh") {
      startMarketplaceSellerOnboarding()
        .then((result) => {
          if (result.url) window.location.assign(result.url);
        })
        .catch((error: Error) => toast.error(error.message));
      return;
    }
    if (connect !== "return") return;
    void stripeStatusQuery.refetch().then((result) => {
      if (result.data?.unavailable || result.error) {
        toast.error(result.data?.error || "Não foi possível verificar os recebimentos. Tente atualizar o status.");
        return;
      }
      void sellerQuery.refetch();
      toast.info(result.data?.chargesEnabled && result.data?.payoutsEnabled
        ? "Recebimentos habilitados pela Stripe."
        : "Cadastro enviado. Aguarde a verificação da Stripe ou continue o cadastro.");
    });
  }, [connect, user, isSeller, isAdmin]);

  useEffect(() => {
    if (!stripeStatusQuery.data?.platformAccount) return;
    void sellerQuery.refetch();
  }, [stripeStatusQuery.data?.platformAccount]);

  const listingsQuery = useQuery({
    queryKey: ["seller-center-listings", user?.id],
    enabled: !!user && (!!isSeller || !!isAdmin),
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_listings")
        .select("id,title,target_type,cover_url,work_type,price_cents,currency,active,moderation_status,created_at")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ListingRow[];
    },
  });

  const foldersQuery = useQuery({
    queryKey: ["seller-center-folders", user?.id],
    enabled: !!user && (!!isSeller || !!isAdmin),
    queryFn: async () => {
      const { data, error } = await db
        .from("library_folders")
        .select("id,name,color")
        .eq("owner_id", user!.id)
        .eq("creator_id", user!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as OwnFolder[];
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["seller-center-orders", user?.id, environment],
    enabled: !!user && (!!isSeller || !!isAdmin),
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_orders")
        .select("id,buyer_id,status,fulfillment_status,total_cents,currency,paid_at,created_at")
        .eq("seller_id", user!.id)
        .eq("stripe_environment", environment)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const orderIds = useMemo(() => ordersQuery.data?.map((order) => order.id) ?? [], [ordersQuery.data]);
  const itemsQuery = useQuery({
    queryKey: ["seller-center-order-items", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_order_items")
        .select("order_id,title,cover_url,price_cents")
        .in("order_id", orderIds);
      if (error) throw error;
      return (data ?? []) as OrderItemRow[];
    },
  });

  const buyerIds = useMemo(
    () => Array.from(new Set((ordersQuery.data ?? []).map((order) => order.buyer_id))),
    [ordersQuery.data],
  );
  const buyersQuery = useQuery({
    queryKey: ["seller-center-buyers", buyerIds.join(",")],
    enabled: buyerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", buyerIds);
      if (error) throw error;
      return (data ?? []) as ProfileMini[];
    },
  });

  const publishFolder = useMutation({
    mutationFn: async () => {
      const cents = Math.round(Number(folderPrice.replace(/\./g, "").replace(",", ".")) * 100);
      if (!folderId) throw new Error("Escolha uma pasta criada por você.");
      if (!Number.isFinite(cents) || cents < 100) throw new Error("Informe um preço válido a partir de R$ 1,00.");
      const { error } = await db.rpc("upsert_marketplace_listing", {
        _target_type: "folder",
        _target_id: folderId,
        _price_cents: cents,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFolderId("");
      void listingsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["marketplace-catalog"] });
      toast.success("Coleção publicada no Marketplace");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleListing = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.rpc("set_marketplace_listing_active", {
        _listing_id: id,
        _active: active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void listingsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["marketplace-catalog"] });
      toast.success("Anúncio atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveBio = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("update_marketplace_seller_profile", { _store_bio: bio.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      void sellerQuery.refetch();
      toast.success("Perfil da loja atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startOnboarding = useMutation({
    mutationFn: startMarketplaceSellerOnboarding,
    onSuccess: (result) => {
      if (result.url) window.location.assign(result.url);
      else void stripeStatusQuery.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || checkingSeller || checkingAdmin) {
    return <PageLoading />;
  }
  if (!user) return <SignInRequired />;
  if (!isSeller && !isAdmin) return <SellerRequired />;

  const seller = sellerQuery.data;
  const stripeStatus = stripeStatusQuery.data;
  const isSuspended = !!seller?.suspended_at;
  const chargesEnabled =
    environment === "live" ? seller?.live_charges_enabled : seller?.sandbox_charges_enabled;
  const payoutsEnabled =
    environment === "live" ? seller?.live_payouts_enabled : seller?.sandbox_payouts_enabled;

  const paidOrders = (ordersQuery.data ?? []).filter((order) => order.status === "paid");
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total_cents), 0);
  const activeListings = (listingsQuery.data ?? []).filter(
    (listing) => listing.active && listing.moderation_status === "active",
  ).length;
  const awaiting = (ordersQuery.data ?? []).filter((order) =>
    ["pending", "awaiting_payment"].includes(order.status),
  ).length;
  const buyerMap = new Map((buyersQuery.data ?? []).map((buyer) => [buyer.id, buyer]));
  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of itemsQuery.data ?? []) {
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  }

  const workspace = (
    <main className="w-full min-w-0">
      <section data-tour="seller-header" className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/75 p-5 shadow-[0_28px_70px_-50px_rgba(0,0,0,.95)] sm:p-7 lg:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="size-14 shrink-0 border border-border/70 sm:size-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback>{profile?.display_name?.slice(0, 1)?.toUpperCase() || "V"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"><Store className="size-3.5" /> Central do vendedor</span>
                <Badge variant="outline">{environment === "live" ? "Produção" : "Sandbox"}</Badge>
              </div>
              <h1 className="min-w-0 break-words font-display text-2xl sm:text-3xl">{section === "overview" ? (profile?.display_name || "Minha loja") : ({ orders: "Pedidos", listings: "Publicações", finance: "Meu financeiro", store: "Configurações da loja" }[section])}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Gerencie suas vendas, recebimentos, anúncios e a apresentação pública da sua loja.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="rounded-xl"><Link to="/marketplace/vendedor/$sellerId" params={{ sellerId: user.id }}><ExternalLink className="size-4" /> Ver loja pública</Link></Button>
            <Button asChild className="rounded-xl"><Link to="/studio" search={{ obra: "", aba: "criar" }}><BookOpen className="size-4" /> Criar nova obra</Link></Button>
          </div>
        </div>
      </section>

      {isSuspended ? (
        <div className="mt-5 flex items-start gap-3 rounded-[1.25rem] border border-destructive/35 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div><p className="font-semibold">Loja temporariamente suspensa</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{seller?.suspension_reason || "Entre em contato com o suporte para obter mais informações."}</p></div>
        </div>
      ) : null}

      {section === "overview" ? <section data-tour="seller-metrics" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Vendas brutas*" value={ordersQuery.isSuccess ? formatMarketplacePrice(revenue) : "Indisponível"} note={`${paidOrders.length} venda(s) paga(s)`} />
        <MetricCard icon={BookOpen} label="Anúncios ativos" value={listingsQuery.isSuccess ? String(activeListings) : "Indisponível"} note={`${listingsQuery.data?.length ?? 0} no total`} />
        <MetricCard icon={ShoppingBag} label="Pedidos em aberto" value={ordersQuery.isSuccess ? String(awaiting) : "Indisponível"} note="Aguardando pagamento" />
        <MetricCard icon={PackageCheck} label="Entregas" value={ordersQuery.isSuccess ? String(paidOrders.filter((o) => o.fulfillment_status === "delivered").length) : "Indisponível"} note="Confirmadas pelo sistema" />
      </section> : null}

      <section className={section === "overview" ? "mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]" : "mt-5 min-w-0 space-y-4"}>
        {(["overview", "finance", "store"] as const).includes(section as "overview" | "finance" | "store") ? <div data-tour="seller-payments">
          <StripeStatusCard
            connected={stripeStatus?.connected ?? false}
            chargesEnabled={stripeStatus?.chargesEnabled ?? false}
            payoutsEnabled={stripeStatus?.payoutsEnabled ?? false}
            detailsSubmitted={stripeStatus?.detailsSubmitted ?? false}
            platformAccount={!!stripeStatus?.platformAccount}
            statusError={stripeStatus?.unavailable ? stripeStatus.error || "Serviço de recebimentos indisponível." : null}
            suspended={isSuspended}
            loading={stripeStatusQuery.isLoading || startOnboarding.isPending}
            onStart={() => startOnboarding.mutate()}
            onRefresh={() => void stripeStatusQuery.refetch().then(() => sellerQuery.refetch())}
          />
        </div> : null}

        {section === "finance" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard icon={CircleDollarSign} label="Vendas pagas brutas*" value={ordersQuery.isSuccess ? formatMarketplacePrice(revenue) : "Indisponível"} note={`${paidOrders.length} pedido(s) na amostra`} />
              <MetricCard icon={ShoppingBag} label="Pedidos pendentes*" value={ordersQuery.isSuccess ? String(awaiting) : "Indisponível"} note={environment === "live" ? "Produção" : "Sandbox"} />
            </div>
            <ManagementNotice title="Saldo e repasses indisponíveis nesta integração" description="Este total considera até 200 pedidos pagos do próprio vendedor no ambiente selecionado. Sem tarifas, comissões, reembolsos e lançamentos conciliados não é possível exibir líquido, disponível ou valor repassado com segurança. Consulte a Stripe para conferir recebimentos reais." />
          </div>
        ) : null}

        <Tabs value={section === "orders" || section === "overview" ? "vendas" : section === "listings" ? "catalogo" : section === "store" ? "config" : "none"} data-tour="seller-tabs" className="min-w-0">


          <TabsContent value="vendas" className="mt-4">
            <div className="rounded-[1.35rem] border border-border/70 bg-card/55 p-3 sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-3 px-1">
                <div><h2 className="font-display text-xl">Pedidos recentes</h2><p className="text-xs text-muted-foreground">O status de pagamento vem do servidor e não pode ser alterado manualmente.</p></div>
                <Button size="icon" variant="outline" className="shrink-0 rounded-xl" onClick={() => void ordersQuery.refetch()}><RefreshCw className="size-4" /></Button>
              </div>
              {ordersQuery.isError ? <ManagementNotice title="Pedidos indisponíveis" description="Não foi possível consultar os pedidos da loja. Confirme acesso, conexão e tente novamente." /> : ordersQuery.isLoading ? <InlineLoading /> : ordersQuery.data?.length ? (
                <div className="grid gap-3">
                  {(section === "overview" ? ordersQuery.data.slice(0, 5) : ordersQuery.data).map((order) => {
                    const buyer = buyerMap.get(order.buyer_id);
                    const items = itemsByOrder.get(order.id) ?? [];
                    return (
                      <article key={order.id} className="rounded-xl border border-border/65 bg-background/35 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><OrderStatus status={order.status} fulfillment={order.fulfillment_status} /><span className="text-[11px] text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span></div>
                            <p className="mt-2 text-sm font-semibold">{buyer?.display_name || "Comprador"}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{items.map((item) => item.title).join(" • ") || "Carregando itens…"}</p>
                            <p className="mt-2 text-[11px] text-muted-foreground">{formatDate(order.created_at)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                            <strong>{formatMarketplacePrice(order.total_cents, order.currency)}</strong>
                            <Button asChild size="sm" variant="outline" className="rounded-lg"><Link to="/social" search={{ friend: order.buyer_id, order: order.id, payment: "" }}>Abrir conversa <ArrowUpRight className="size-3.5" /></Link></Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <EmptyState title="Nenhuma venda ainda" text="Quando um comprador iniciar um pedido, ele aparecerá aqui." />}
            </div>
          </TabsContent>

          <TabsContent value="catalogo" className="mt-4">
            <div className="rounded-[1.35rem] border border-border/70 bg-card/55 p-3 sm:p-4">
              <div className="mb-4 flex items-end justify-between gap-3 px-1"><div><h2 className="font-display text-xl">Meu catálogo</h2><p className="text-xs text-muted-foreground">Obras criadas no Estúdio entram automaticamente no Marketplace.</p></div><Button asChild size="sm"><Link to="/studio" search={{ obra: "", aba: "criar" }}>Nova obra</Link></Button></div>

              <div className="mb-4 rounded-xl border border-border/65 bg-background/30 p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><PackagePlus className="size-4" /></span>
                  <div><p className="text-sm font-semibold">Publicar uma pasta como coleção</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Todos os arquivos da pasta precisam ter sido criados por você. A compra da coleção gera um código próprio para o item.</p></div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                  <select value={folderId} onChange={(event) => setFolderId(event.target.value)} className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Escolha uma pasta</option>
                    {(foldersQuery.data ?? []).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                  <Input value={folderPrice} onChange={(event) => setFolderPrice(event.target.value)} inputMode="decimal" placeholder="19,90" />
                  <Button disabled={!chargesEnabled || !folderId || publishFolder.isPending || isSuspended} onClick={() => publishFolder.mutate()} className="rounded-xl">
                    {publishFolder.isPending ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />} Publicar coleção
                  </Button>
                </div>
                {!chargesEnabled ? <p className="mt-2 text-[11px] text-muted-foreground">Conclua a configuração de recebimentos para publicar coleções manualmente.</p> : null}
              </div>

              {listingsQuery.isError ? <ManagementNotice title="Publicações indisponíveis" description="A consulta aos anúncios falhou. Não exibiremos um catálogo vazio por engano." /> : listingsQuery.isLoading ? <InlineLoading /> : listingsQuery.data?.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {listingsQuery.data.map((listing) => (
                    <article key={listing.id} className="overflow-hidden rounded-xl border border-border/65 bg-background/35">
                      <div className="aspect-[16/10] bg-muted/50"><PublicationCover coverUrl={listing.cover_url} workType={listing.work_type} title={listing.title} fit="contain" className="h-full w-full" fallback={<div className="grid h-full place-items-center"><Store className="size-8 text-muted-foreground" /></div>} /></div>
                      <div className="p-3"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-semibold">{listing.title}</p><ListingStatus listing={listing} /></div><p className="mt-2 text-sm">{formatMarketplacePrice(listing.price_cents, listing.currency)}</p><div className="mt-3 grid grid-cols-2 gap-2"><Button asChild variant="outline" size="sm" className="rounded-lg"><Link to="/marketplace/item/$listingId" params={{ listingId: listing.id }}>Ver anúncio</Link></Button><Button variant="outline" size="sm" className="rounded-lg" disabled={toggleListing.isPending || listing.moderation_status === "removed"} onClick={() => toggleListing.mutate({ id: listing.id, active: !listing.active })}>{listing.active ? "Pausar" : "Reativar"}</Button></div></div>
                    </article>
                  ))}
                </div>
              ) : <EmptyState title="Nenhum anúncio" text="Crie uma obra no Estúdio para iniciar seu catálogo." />}
            </div>
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <div className="rounded-[1.35rem] border border-border/70 bg-card/55 p-5 sm:p-6">
              <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Settings2 className="size-5" /></span><div><h2 className="font-display text-xl">Apresentação da loja</h2><p className="text-xs text-muted-foreground">Este texto aparece no perfil público do vendedor.</p></div></div>
              <div className="mt-5 space-y-1.5"><Label htmlFor="store-bio">Sobre sua loja</Label><Textarea id="store-bio" rows={5} maxLength={600} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte aos leitores que tipo de conteúdo você publica e o que podem encontrar no seu catálogo." /><div className="flex justify-between text-[11px] text-muted-foreground"><span>Evite links externos e dados pessoais.</span><span>{bio.length}/600</span></div></div>
              <Button className="mt-4 w-full rounded-xl sm:w-auto" disabled={saveBio.isPending || bio === (seller?.store_bio ?? "")} onClick={() => saveBio.mutate()}>{saveBio.isPending ? "Salvando…" : "Salvar apresentação"}</Button>
            </div>
          </TabsContent>
        </Tabs>
      </section>
      {section === "overview" ? <p className="mt-4 text-xs text-muted-foreground">*Indicadores baseados nos últimos 200 pedidos consultados. Não representam saldo ou lucro.</p> : null}
    </main>
  );
  return <ManagementNavigation area="seller">{workspace}</ManagementNavigation>;
}

function MetricCard({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return <div className="rounded-[1.25rem] border border-border/70 bg-card/55 p-4 sm:p-5"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span></div><p className="mt-4 font-display text-2xl">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function StripeStatusCard({
  connected,
  chargesEnabled,
  payoutsEnabled,
  detailsSubmitted,
  platformAccount,
  statusError,
  suspended,
  loading,
  onStart,
  onRefresh,
}: {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  platformAccount: boolean;
  statusError: string | null;
  suspended: boolean;
  loading: boolean;
  onStart: () => void;
  onRefresh: () => void;
}) {
  const ready = chargesEnabled && payoutsEnabled && !suspended;

  return (
    <aside className="rounded-[1.35rem] border border-border/70 bg-card/55 p-5 sm:p-6 xl:sticky xl:top-28 xl:self-start">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <WalletCards className="size-5" />
        </span>
        {ready ? (
          <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
            {platformAccount ? "Stripe principal" : "Pronto para vender"}
          </Badge>
        ) : (
          <Badge variant="outline">Recebimentos</Badge>
        )}
      </div>

      <h2 className="mt-5 font-display text-xl">
        {platformAccount ? "Recebimentos do BookSyde" : "Meus recebimentos"}
      </h2>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {platformAccount
          ? "Esta conta de administrador recebe as vendas diretamente na conta Stripe principal do BookSyde, a mesma utilizada para os planos. Não é necessário criar uma conta Stripe Connect separada."
          : "Cadastre seus dados pessoais e a conta onde deseja receber suas vendas. Por enquanto, o BookSyde aceita somente vendedores pessoa física."}
      </p>

      {!connected && !platformAccount ? (
        <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
          Você não precisa ter empresa ou CNPJ. A verificação é feita com seus dados pessoais e as informações necessárias para receber pagamentos.
        </div>
      ) : null}

      {platformAccount ? (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/8 p-3 text-xs leading-5 text-muted-foreground">
          As compras dos seus anúncios são cobradas na conta principal da plataforma. Os demais criadores continuam recebendo pelas próprias contas conectadas.
        </div>
      ) : null}

      {statusError ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs leading-5 text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{statusError}</span>
        </div>
      ) : null}

      <div className={`mt-5 grid gap-2 ${statusError ? "opacity-50" : ""}`}>
        <StatusLine ok={connected} label={platformAccount ? "Conta principal vinculada" : "Cadastro iniciado"} />
        <StatusLine ok={detailsSubmitted} label={platformAccount ? "Configuração da plataforma ativa" : "Dados pessoais enviados"} />
        <StatusLine ok={chargesEnabled} label="Vendas habilitadas" />
        <StatusLine ok={payoutsEnabled} label={platformAccount ? "Recebimento direto habilitado" : "Recebimentos habilitados"} />
      </div>

      {suspended ? (
        <p className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
          Sua loja está suspensa. A configuração de recebimentos não altera a moderação da plataforma.
        </p>
      ) : null}

      <div className={`mt-5 grid gap-2 ${platformAccount ? "" : "sm:grid-cols-2 xl:grid-cols-1"}`}>
        {!platformAccount ? (
          <Button disabled={loading || ready || suspended} onClick={onStart} className="rounded-xl">
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : connected ? (
              "Continuar cadastro"
            ) : (
              "Ativar recebimentos"
            )}
          </Button>
        ) : null}
        <Button variant="outline" disabled={loading} onClick={onRefresh} className="rounded-xl">
          <RefreshCw className="size-4" /> Atualizar status
        </Button>
      </div>

      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
        {platformAccount
          ? "A cobrança usa a mesma conexão Stripe configurada para os planos do BookSyde."
          : "A validação financeira é processada com segurança pela Stripe."}
      </p>
    </aside>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) { return <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5 text-xs"><span className={`grid size-5 place-items-center rounded-full ${ok ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"}`}>{ok ? <CheckCircle2 className="size-3.5" /> : <Clock3 className="size-3.5" />}</span><span>{label}</span></div>; }
function OrderStatus({ status, fulfillment }: { status: string; fulfillment: string }) { const paid = status === "paid"; const label = status === "awaiting_payment" ? "Aguardando pagamento" : status === "paid" ? fulfillment === "delivered" ? "Pago e entregue" : "Pago" : status === "refunded" ? "Reembolsado" : status === "expired" ? "Expirado" : status === "canceled" ? "Cancelado" : "Criado"; return <Badge variant={paid ? "default" : "outline"}>{label}</Badge>; }
function ListingStatus({ listing }: { listing: ListingRow }) { if (listing.moderation_status === "removed") return <Badge variant="destructive">Removido</Badge>; if (listing.moderation_status === "under_review") return <Badge variant="outline">Em análise</Badge>; if (!listing.active) return <Badge variant="outline">Inativo</Badge>; return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Ativo</Badge>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border border-dashed border-border/75 px-5 py-10 text-center"><Store className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{text}</p></div>; }
function InlineLoading() { return <div className="grid min-h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>; }
function PageLoading() { return <main className="mx-auto grid min-h-[50vh] w-full max-w-4xl place-items-center px-4"><Loader2 className="size-7 animate-spin text-primary" /></main>; }
function SignInRequired() { return <main className="mx-auto max-w-lg px-4 py-20 text-center"><WalletCards className="mx-auto size-8 text-primary" /><h1 className="mt-4 font-display text-2xl">Entre para acessar sua central</h1><Button asChild className="mt-6"><Link to="/auth">Entrar</Link></Button></main>; }
function SellerRequired() { return <main className="mx-auto max-w-lg px-4 py-20 text-center"><BadgeCheck className="mx-auto size-8 text-primary" /><h1 className="mt-4 font-display text-2xl">Área do vendedor</h1><p className="mt-2 text-sm text-muted-foreground">Ative as vendas pelo Marketplace para liberar esta área.</p><Button asChild className="mt-6"><Link to="/marketplace">Voltar ao Marketplace</Link></Button></main>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

export function SellerOverviewRoutePage() {
  return <SellerCenterPage section="overview" />;
}

export function SellerOrdersRoutePage() {
  return <SellerCenterPage section="orders" />;
}

export function SellerListingsRoutePage() {
  return <SellerCenterPage section="listings" />;
}

export function SellerFinanceRoutePage() {
  return <SellerCenterPage section="finance" />;
}

export function SellerStoreRoutePage() {
  return <SellerCenterPage section="store" />;
}
