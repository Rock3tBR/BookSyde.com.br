import { Route } from "@/routes/marketplace_.item.$listingId";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Boxes,
  Heart,
  Loader2,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PublicationCover } from "@/components/PublicationCover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMarketplacePrice } from "@/lib/marketplace";
import { getStripeEnvironment } from "@/lib/stripe";
import { cn } from "@/lib/utils";

const db = supabase as any;

type ListingDetail = {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_avatar_url: string | null;
  seller_bio: string;
  target_type: "manga" | "folder";
  manga_id: string | null;
  folder_id: string | null;
  title: string;
  author: string;
  category: string;
  work_type: string;
  cover_url: string | null;
  folder_color: string | null;
  manga_ids: string[];
  manga_slug: string | null;
  description: string;
  synopsis: string;
  genres: string[];
  price_cents: number;
  currency: string;
  sandbox_charges_enabled: boolean;
  live_charges_enabled: boolean;
  created_at: string;
};

type SellerStats = {
  seller_id: string;
  display_name: string;
  avatar_url: string | null;
  profile_created_at: string;
  published_count: number;
  sandbox_sales_count: number;
  live_sales_count: number;
  featured: boolean;
};

type CollectionItem = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  work_type: string;
  slug: string;
};

export function MarketplaceItemPage() {
  const { listingId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const environment = getStripeEnvironment();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("copyright");
  const [reportDetails, setReportDetails] = useState("");

  const listingQuery = useQuery({
    queryKey: ["marketplace-item", listingId],
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_catalog")
        .select("*")
        .eq("id", listingId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const listing = data as ListingDetail;

      if (listing.target_type === "folder" && !(listing.manga_ids?.length > 0)) {
        const { data: sourceListing } = await db
          .from("marketplace_listings")
          .select("manga_ids")
          .eq("id", listingId)
          .maybeSingle();

        if (sourceListing?.manga_ids?.length) {
          listing.manga_ids = sourceListing.manga_ids;
        }
      }

      return listing;
    },
  });

  const collectionItemsQuery = useQuery({
    queryKey: ["marketplace-collection-items", listingId, listingQuery.data?.manga_ids?.join(",")],
    enabled: listingQuery.data?.target_type === "folder" && !!listingQuery.data?.manga_ids?.length,
    queryFn: async () => {
      const ids = listingQuery.data!.manga_ids;
      const { data, error } = await db
        .from("mangas")
        .select("id,title,author,cover_url,work_type,slug")
        .in("id", ids);

      if (error) throw error;

      const byId = new Map(
        ((data ?? []) as CollectionItem[]).map((item) => [item.id, item]),
      );

      return ids
        .map((id) => byId.get(id))
        .filter((item): item is CollectionItem => !!item);
    },
  });

  const sellerQuery = useQuery({
    queryKey: ["marketplace-item-seller", listingQuery.data?.seller_id, environment],
    enabled: !!listingQuery.data?.seller_id,
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_seller_stats")
        .select("*")
        .eq("seller_id", listingQuery.data!.seller_id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SellerStats | null;
    },
  });

  const accessQuery = useQuery({
    queryKey: ["marketplace-item-access", user?.id, listingQuery.data?.manga_ids?.join(",")],
    enabled: !!user && !!listingQuery.data?.manga_ids?.length,
    queryFn: async () => {
      const ids = listingQuery.data!.manga_ids;
      const results = await Promise.all(
        ids.map(async (mangaId) => {
          const { data, error } = await db.rpc("can_access_manga", {
            _user_id: user!.id,
            _manga_id: mangaId,
          });
          if (error) throw error;
          return !!data;
        }),
      );
      return results.every(Boolean);
    },
  });

  const wishlistQuery = useQuery({
    queryKey: ["marketplace-item-wishlist", user?.id, listingId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_wishlist")
        .select("listing_id")
        .eq("user_id", user!.id)
        .eq("listing_id", listingId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const toggleWishlist = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta para usar a lista de desejos.");
      if (wishlistQuery.data) {
        const { error } = await db.from("marketplace_wishlist").delete().eq("user_id", user.id).eq("listing_id", listingId);
        if (error) throw error;
      } else {
        const { error } = await db.from("marketplace_wishlist").insert({ user_id: user.id, listing_id: listingId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void wishlistQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["marketplace-wishlist"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const buyNow = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta para comprar.");
      const { data, error } = await db.rpc("create_marketplace_order", {
        _listing_ids: [listingId],
        _environment: environment,
      });
      if (error) throw error;
      return data as { order_id: string; seller_id: string };
    },
    onSuccess: (order) => {
      toast.success("Pedido criado. A conversa com o vendedor foi aberta.");
      void navigate({
        to: "/social",
        search: { friend: order.seller_id, order: order.order_id, payment: "" },
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta para denunciar um anúncio.");
      const { error } = await db.rpc("report_marketplace_listing", {
        _listing_id: listingId,
        _reason: reportReason,
        _details: reportDetails.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReportOpen(false);
      setReportDetails("");
      toast.success("Denúncia enviada para análise");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const listing = listingQuery.data;
  const seller = sellerQuery.data;
  const collectionItemCount = listing?.target_type === "folder" ? (listing.manga_ids?.length ?? 0) : 0;
  const owns = !!accessQuery.data;
  const checkingAccess = !!user && !!listing?.manga_ids?.length && accessQuery.isLoading;
  const sellerReady = listing
    ? environment === "live"
      ? listing.live_charges_enabled
      : listing.sandbox_charges_enabled
    : false;
  const sales = seller
    ? Number(environment === "live" ? seller.live_sales_count : seller.sandbox_sales_count)
    : 0;
  const tags = useMemo(
    () => [listing?.category, listing?.work_type, ...(listing?.genres ?? [])].filter(Boolean).slice(0, 6) as string[],
    [listing],
  );

  if (listingQuery.isLoading) {
    return <main className="mx-auto grid min-h-[55vh] max-w-5xl place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></main>;
  }
  if (!listing) {
    return <main className="mx-auto max-w-lg px-4 py-20 text-center"><Package className="mx-auto size-9 text-muted-foreground" /><h1 className="mt-4 font-display text-3xl">Anúncio indisponível</h1><p className="mt-2 text-sm text-muted-foreground">O item foi removido, desativado ou não existe mais.</p><Button asChild className="mt-6"><Link to="/marketplace">Voltar ao Marketplace</Link></Button></main>;
  }

  return (
    <main className="w-full px-3 pb-24 pt-4 sm:px-5 sm:pt-8 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-3 rounded-xl"><Link to="/marketplace"><ArrowLeft className="size-4" /> Marketplace</Link></Button>

      <section className="grid gap-5 lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)] lg:items-stretch">
        <div className="overflow-hidden rounded-[1.65rem] border border-border/70 bg-card/65 shadow-[0_26px_70px_-52px_rgba(0,0,0,.95)]">
          <div className="relative flex min-h-[430px] h-full items-center justify-center overflow-hidden bg-muted/35 sm:min-h-[540px] lg:min-h-[610px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,hsl(var(--primary)/0.08),transparent_55%)]" />
            <PublicationCover
              coverUrl={listing.cover_url} workType={listing.work_type}
              title={listing.title}
              fit="contain" className="relative z-10 h-full max-h-[610px] w-full p-3 sm:p-5 lg:p-6"
              fallback={
                <div className="relative z-10 grid place-items-center gap-3 text-center text-muted-foreground">
                  <Package className="size-12" />
                  <span className="text-xs">Capa indisponível</span>
                </div>
              }
            />
          </div>
        </div>

        <section className="flex min-h-[430px] flex-col rounded-[1.65rem] border border-border/70 bg-card/65 p-5 shadow-[0_26px_70px_-52px_rgba(0,0,0,.95)] sm:min-h-[540px] sm:p-7 lg:min-h-[610px] lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{listing.target_type === "folder" ? "Coleção" : workTypeLabel(listing.work_type)}</Badge>
              {seller?.featured ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15"><BadgeCheck className="mr-1 size-3" /> Vendedor em destaque</Badge> : null}
              {owns ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15"><ShieldCheck className="mr-1 size-3" /> Na sua biblioteca</Badge> : null}
            </div>
            <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">{listing.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {listing.target_type === "folder"
                ? collectionItemCount > 0
                  ? `Coleção com ${collectionItemCount} ${collectionItemCount === 1 ? "item" : "itens"}`
                  : "Coleção digital"
                : listing.author || "Autor não informado"}
            </p>
            <p className="mt-5 text-2xl font-semibold">{formatMarketplacePrice(listing.price_cents, listing.currency)}</p>

            {listing.target_type === "folder" && collectionItemCount > 0 ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/8 p-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Boxes className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">A compra libera {collectionItemCount} {collectionItemCount === 1 ? "item" : "itens"}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Todos os itens listados nesta coleção serão adicionados ao acesso do comprador após a confirmação do pagamento.</p>
                </div>
              </div>
            ) : null}

            {tags.length ? <div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full border border-border/70 bg-background/35 px-2.5 py-1 text-[11px] text-muted-foreground">{tag}</span>)}</div> : null}

            <p className="mt-5 text-sm leading-7 text-muted-foreground">{listing.synopsis || listing.description || "Publicação digital disponibilizada no Marketplace BookSyde."}</p>
          </div>

          <div className="mt-auto pt-7">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              {checkingAccess ? (
                <Button size="lg" className="min-h-12 rounded-xl" disabled>
                  <Loader2 className="size-5 animate-spin" /> Verificando sua biblioteca…
                </Button>
              ) : owns ? (
                <Button asChild size="lg" className="min-h-12 rounded-xl">
                  {listing.target_type === "manga" && listing.manga_slug ? <Link to="/manga/$slug" params={{ slug: listing.manga_slug }} search={{ invite: "" }}><BookOpen className="size-5" /> Começar leitura</Link> : <Link to="/biblioteca"><BookOpen className="size-5" /> Abrir na biblioteca</Link>}
                </Button>
              ) : (
                <Button size="lg" className="min-h-12 rounded-xl" disabled={buyNow.isPending || !sellerReady || user?.id === listing.seller_id} onClick={() => user ? buyNow.mutate() : void navigate({ to: "/auth" })}>
                  {buyNow.isPending ? <Loader2 className="size-5 animate-spin" /> : <ShoppingBag className="size-5" />}
                  {user?.id === listing.seller_id ? "Este anúncio é seu" : sellerReady ? "Comprar com o vendedor" : "Vendedor configurando recebimentos"}
                </Button>
              )}
              {!checkingAccess && !owns ? <Button size="lg" variant="outline" className="min-h-12 rounded-xl" onClick={() => user ? toggleWishlist.mutate() : void navigate({ to: "/auth" })}><Heart className={cn("size-5", wishlistQuery.data && "fill-current text-primary")} /><span className="sm:hidden">Lista de desejos</span></Button> : null}
            </div>

            {!owns && sellerReady ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Ao continuar, o pedido será criado com este vendedor e o chat abrirá com a mensagem automática do pedido. O texto e o valor do pedido não podem ser editados pelo comprador.</p> : null}
          </div>
        </section>
      </section>

      {listing.target_type === "folder" ? (
        <section className="mt-5 rounded-[1.65rem] border border-border/70 bg-card/65 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Boxes className="size-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">Conteúdo da coleção</p>
              </div>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl">O que você recebe</h2>
              <p className="mt-1 text-sm text-muted-foreground">Confira as obras que fazem parte desta compra.</p>
            </div>
            {collectionItemCount > 0 ? (
              <Badge variant="outline" className="w-fit">
                {collectionItemCount} {collectionItemCount === 1 ? "item" : "itens"}
              </Badge>
            ) : null}
          </div>

          {collectionItemsQuery.isLoading ? (
            <div className="mt-5 flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-border/70">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : collectionItemsQuery.isError ? (
            <div className="mt-5 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-muted-foreground">
              Não foi possível carregar os itens desta coleção agora. Tente novamente em instantes.
            </div>
          ) : collectionItemsQuery.data?.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {collectionItemsQuery.data.map((item, index) => (
                <article key={item.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/65 bg-background/35 p-3">
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <PublicationCover
                      coverUrl={item.cover_url} workType={item.work_type}
                      title={item.title}
                      className="size-full object-cover"
                      fallback={<div className="grid size-full place-items-center"><BookOpen className="size-5 text-muted-foreground" /></div>}
                    />
                    <span className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white">{index + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="mb-1.5 h-5 px-2 text-[9px]">{workTypeLabel(item.work_type)}</Badge>
                    <p className="line-clamp-2 text-sm font-semibold leading-5">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.author || "Autor não informado"}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              Nenhum item foi encontrado nesta coleção.
            </div>
          )}
        </section>
      ) : null}

      <section className="mt-5 rounded-[1.65rem] border border-border/70 bg-card/65 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/marketplace/vendedor/$sellerId" params={{ sellerId: listing.seller_id }} className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12 border border-border/70"><AvatarImage src={listing.seller_avatar_url ?? undefined} /><AvatarFallback>{listing.seller_name?.slice(0, 1)?.toUpperCase() || "V"}</AvatarFallback></Avatar>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{listing.seller_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{seller?.published_count ?? "—"} arquivo(s) • {sales} venda(s)</p></div>
          </Link>
          <Button asChild variant="outline" className="rounded-xl"><Link to="/marketplace/vendedor/$sellerId" params={{ sellerId: listing.seller_id }}><Store className="size-4" /> Ver catálogo</Link></Button>
        </div>
        {listing.seller_bio ? <p className="mt-4 text-xs leading-6 text-muted-foreground">{listing.seller_bio}</p> : null}
      </section>

      <section className="mt-4 flex flex-col gap-3 rounded-[1.35rem] border border-border/70 bg-card/45 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><span>O vendedor declara possuir os direitos ou autorizações necessários para comercializar o conteúdo.</span></div>
        {user?.id !== listing.seller_id ? <Button variant="ghost" size="sm" className="shrink-0 rounded-lg text-muted-foreground" onClick={() => user ? setReportOpen(true) : void navigate({ to: "/auth" })}><AlertTriangle className="size-4" /> Denunciar anúncio</Button> : null}
      </section>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-lg rounded-[1.35rem]">
          <DialogHeader><DialogTitle>Denunciar anúncio</DialogTitle><DialogDescription>A denúncia entra na fila de moderação para análise da equipe.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><label className="text-sm font-medium">Motivo</label><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="copyright">Direitos autorais</option><option value="misleading">Informações enganosas</option><option value="illegal">Conteúdo ilícito</option><option value="spam">Spam</option><option value="other">Outro</option></select></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Detalhes</label><Textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} rows={5} maxLength={3000} placeholder="Explique o motivo da denúncia e inclua detalhes que ajudem na análise." /></div>
            <Button className="w-full rounded-xl" disabled={reportMutation.isPending} onClick={() => reportMutation.mutate()}>{reportMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />} Enviar denúncia</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function workTypeLabel(type: string) { if (type === "hq") return "HQ"; if (type === "book") return "Livro"; if (type === "gibi") return "Gibi"; return "Mangá"; }
