import { useCatalogDisplayPreferences } from "@/hooks/useCatalogDisplayPreferences";
import { Route } from "@/routes/marketplace";
import { type HTMLAttributes, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Heart,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
  ShoppingBag,
  Store,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PublicationCover } from "@/components/PublicationCover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useIsCreator, useIsSeller } from "@/lib/auth";
import {
  createMarketplaceCheckout,
  formatMarketplacePrice,
  startMarketplaceSellerOnboarding,
  syncMarketplaceSellerStatus,
} from "@/lib/marketplace";
import { getStripeEnvironment } from "@/lib/stripe";
import { cn } from "@/lib/utils";
import { getCatalogDisplayStyle } from "@/lib/catalogDisplay";

type DbError = { message: string };
type RpcResult = { data: unknown; error: DbError | null };

const marketplaceDb = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

type CatalogListing = {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_avatar_url: string | null;
  target_type: "manga" | "folder";
  title: string;
  author: string;
  category: string;
  work_type: string;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  created_at: string;
  manga_ids: string[];
};

type SellerStats = {
  seller_id: string;
  display_name: string;
  avatar_url: string | null;
  profile_created_at: string;
  featured: boolean;
  published_count: number;
  sales_count: number;
};

type SellerStatsRow = Omit<SellerStats, "sales_count"> & {
  sandbox_charges_enabled: boolean;
  live_charges_enabled: boolean;
  sandbox_sales_count: number;
  live_sales_count: number;
};

type SellerRow = {
  user_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
};

type OrderCreateResult = {
  order_id: string;
  seller_id: string;
  total_cents: number;
};

type MarketplaceSort = "recent" | "oldest" | "price-asc" | "price-desc" | "title";
type MarketplaceType = "all" | "book" | "manga" | "hq" | "gibi" | "folder";

const TYPE_FILTERS: Array<{ value: MarketplaceType; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "book", label: "Livros" },
  { value: "manga", label: "Mangás" },
  { value: "hq", label: "HQs" },
  { value: "gibi", label: "Gibis" },
  { value: "folder", label: "Coleções" },
];

type SimilarListingRow = {
  listing_id: string;
  similarity_score: number;
  source_title: string;
};

export function MarketplacePage() {
  const { user, loading } = useAuth();
  const { data: isCreator } = useIsCreator();
  const { data: isAdmin } = useIsAdmin();
  const { data: isSeller } = useIsSeller();
  const catalogDisplayPreferences = useCatalogDisplayPreferences();
  const { seller: sellerFromUrl, connect, similarTo } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const paymentEnvironment = getStripeEnvironment();
  const salesColumn =
    paymentEnvironment === "live" ? "live_sales_count" : "sandbox_sales_count";

  const [nameFilter, setNameFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<MarketplaceType>("all");
  const [sortOrder, setSortOrder] = useState<MarketplaceSort>("recent");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: catalog = [], isLoading: loadingCatalog, isError: catalogError, refetch: refetchCatalog } = useQuery({
    queryKey: ["marketplace-catalog", paymentEnvironment],
    queryFn: async () => {
      // A view marketplace_catalog pode não existir/estar desatualizada em projetos
      // Supabase que ainda não receberam a migration mais recente. Nesse caso,
      // consulta diretamente marketplace_listings (que já possui RLS pública para active=true).
      const viewResult = await marketplaceDb
        .from("marketplace_catalog")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      let rows: CatalogListing[];
      if (!viewResult.error) {
        rows = (viewResult.data ?? []) as unknown as CatalogListing[];
      } else {
        console.warn("[marketplace] marketplace_catalog indisponível; usando marketplace_listings", viewResult.error);
        const fallback = await marketplaceDb
          .from("marketplace_listings")
          .select("id,seller_id,target_type,title,author,category,work_type,cover_url,price_cents,currency,created_at,manga_ids")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(500);
        if (fallback.error) throw fallback.error;
        rows = ((fallback.data ?? []) as any[]).map((listing) => ({
          ...listing,
          seller_name: "Vendedor BookSyde",
          seller_avatar_url: null,
          manga_ids: listing.manga_ids ?? [],
        })) as CatalogListing[];
      }
      const folderIdsMissingItems = rows
        .filter((listing) => listing.target_type === "folder" && !(listing.manga_ids?.length > 0))
        .map((listing) => listing.id);

      if (!folderIdsMissingItems.length) return rows;

      const { data: listingRows } = await marketplaceDb
        .from("marketplace_listings")
        .select("id,manga_ids")
        .in("id", folderIdsMissingItems);

      const mangaIdsByListing = new Map(
        ((listingRows ?? []) as Array<{ id: string; manga_ids?: string[] | null }>).map((row) => [
          row.id,
          row.manga_ids ?? [],
        ]),
      );

      return rows.map((listing) => ({
        ...listing,
        manga_ids: listing.manga_ids?.length ? listing.manga_ids : (mangaIdsByListing.get(listing.id) ?? []),
      }));
    },
  });

  const { data: similarRows = [], isLoading: loadingSimilar } = useQuery({
    queryKey: ["marketplace-similar", similarTo],
    enabled: !!similarTo,
    queryFn: async () => {
      const { data, error } = await marketplaceDb.rpc("get_similar_marketplace_listings", {
        _manga_id: similarTo,
        _limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as unknown as SimilarListingRow[];
    },
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["marketplace-sellers", paymentEnvironment],
    queryFn: async () => {
      const statsResult = await marketplaceDb
        .from("marketplace_seller_stats")
        .select("*")
        .order("featured", { ascending: false })
        .order(salesColumn, { ascending: false })
        .order("published_count", { ascending: false })
        .limit(8);
      if (!statsResult.error) {
        return ((statsResult.data ?? []) as unknown as SellerStatsRow[]).map((seller) => ({
          seller_id: seller.seller_id,
          display_name: seller.display_name || "Vendedor BookSyde",
          avatar_url: seller.avatar_url,
          profile_created_at: seller.profile_created_at,
          featured: seller.featured,
          published_count: Number(seller.published_count ?? 0),
          sales_count: Number(seller[salesColumn] ?? 0),
        }));
      }

      // Fallback: monta a vitrine de vendedores a partir dos próprios anúncios ativos.
      // Assim o Marketplace não fica vazio só porque a view de estatísticas não foi criada.
      console.warn("[marketplace] marketplace_seller_stats indisponível; derivando vendedores dos anúncios", statsResult.error);
      const fallback = await marketplaceDb
        .from("marketplace_listings")
        .select("seller_id,created_at")
        .eq("active", true)
        .limit(500);
      if (fallback.error) throw fallback.error;
      const grouped = new Map<string, { count: number; created_at: string }>();
      for (const row of (fallback.data ?? []) as any[]) {
        if (!row.seller_id) continue;
        const current = grouped.get(row.seller_id);
        if (current) current.count += 1;
        else grouped.set(row.seller_id, { count: 1, created_at: row.created_at ?? new Date(0).toISOString() });
      }
      return Array.from(grouped.entries()).map(([seller_id, info]) => ({
        seller_id,
        display_name: "Vendedor BookSyde",
        avatar_url: null,
        profile_created_at: info.created_at,
        featured: false,
        published_count: info.count,
        sales_count: 0,
      })).sort((a, b) => b.published_count - a.published_count).slice(0, 8);
    },
  });

  const { data: wishlist = [] } = useQuery({
    queryKey: ["marketplace-wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await marketplaceDb
        .from("marketplace_wishlist")
        .select("listing_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ listing_id: string }>;
    },
  });

  const wishlistIds = useMemo(() => new Set(wishlist.map((item) => item.listing_id)), [wishlist]);

  const { data: sellerStatus } = useQuery({
    queryKey: ["marketplace-seller-status", user?.id, paymentEnvironment],
    enabled: !!user && (!!isSeller || !!isAdmin),
    staleTime: 15_000,
    queryFn: async () => {
      const status = await syncMarketplaceSellerStatus();
      return {
        user_id: user!.id,
        charges_enabled: status.chargesEnabled,
        payouts_enabled: status.payoutsEnabled,
        details_submitted: status.detailsSubmitted,
      } satisfies SellerRow;
    },
  });

  const activateSeller = useMutation({
    mutationFn: startMarketplaceSellerOnboarding,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["is-seller", user?.id] });
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["marketplace-seller-status"] });
      void navigate({ to: "/marketplace/vendedor", search: { connect: "" } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!user || !connect || (!isSeller && !isAdmin)) return;
    let canceled = false;

    if (connect === "refresh") {
      startMarketplaceSellerOnboarding()
        .then((result) => {
          if (!canceled && result.url) window.location.assign(result.url);
        })
        .catch((error: Error) => {
          if (!canceled) toast.error(error.message);
        });

      return () => {
        canceled = true;
      };
    }

    syncMarketplaceSellerStatus()
      .then((status) => {
        if (canceled) return;
        void queryClient.invalidateQueries({ queryKey: ["marketplace-seller-status"] });
        void queryClient.invalidateQueries({ queryKey: ["marketplace-sellers"] });
        void queryClient.invalidateQueries({ queryKey: ["marketplace-catalog"] });
        toast.success(
          status.chargesEnabled
            ? "Recebimentos ativados. Você já pode publicar anúncios."
            : "Cadastro recebido. A Stripe ainda está validando os dados da conta.",
        );
        void navigate({
          to: "/marketplace",
          search: { seller: sellerFromUrl || "", connect: "", similarTo: similarTo || "" },
          replace: true,
        });
      })
      .catch((error: Error) => {
        if (!canceled) toast.error(error.message);
      });

    return () => {
      canceled = true;
    };
  }, [connect, isAdmin, isSeller, navigate, queryClient, sellerFromUrl, similarTo, user]);

  const categories = useMemo(
    () => [...new Set(catalog.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [catalog],
  );

  const similarityByListing = useMemo(
    () => new Map(similarRows.map((row) => [row.listing_id, Number(row.similarity_score ?? 0)])),
    [similarRows],
  );
  const similarSourceTitle = similarRows[0]?.source_title ?? "";

  const filteredCatalog = useMemo(() => {
    const q = nameFilter.trim().toLocaleLowerCase("pt-BR");
    const author = authorFilter.trim().toLocaleLowerCase("pt-BR");
    const min = minPrice ? Math.round(Number(minPrice.replace(",", ".")) * 100) : null;
    const max = maxPrice ? Math.round(Number(maxPrice.replace(",", ".")) * 100) : null;

    const items = catalog.filter((item) => {
      if (similarTo && !similarityByListing.has(item.id)) return false;
      if (sellerFromUrl && item.seller_id !== sellerFromUrl) return false;
      if (q && !item.title.toLocaleLowerCase("pt-BR").includes(q)) return false;
      if (author && !item.author.toLocaleLowerCase("pt-BR").includes(author)) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (typeFilter === "folder" && item.target_type !== "folder") return false;
      if (typeFilter !== "all" && typeFilter !== "folder" && (item.target_type === "folder" || item.work_type !== typeFilter)) return false;
      if (min !== null && Number.isFinite(min) && item.price_cents < min) return false;
      if (max !== null && Number.isFinite(max) && item.price_cents > max) return false;
      return true;
    });

    if (similarTo) {
      items.sort((a, b) => (similarityByListing.get(b.id) ?? 0) - (similarityByListing.get(a.id) ?? 0));
    } else {
      items.sort((a, b) => {
        switch (sortOrder) {
          case "oldest": return Date.parse(a.created_at) - Date.parse(b.created_at);
          case "price-asc": return a.price_cents - b.price_cents;
          case "price-desc": return b.price_cents - a.price_cents;
          case "title": return a.title.localeCompare(b.title, "pt-BR");
          default: return Date.parse(b.created_at) - Date.parse(a.created_at);
        }
      });
    }

    return items;
  }, [
    authorFilter,
    catalog,
    categoryFilter,
    maxPrice,
    minPrice,
    nameFilter,
    sellerFromUrl,
    similarTo,
    similarityByListing,
    sortOrder,
    typeFilter,
  ]);

  const wishlistListings = useMemo(
    () => catalog.filter((item) => wishlistIds.has(item.id)),
    [catalog, wishlistIds],
  );

  const selectedGroups = useMemo(() => {
    const groups = new Map<string, { seller: CatalogListing; items: CatalogListing[] }>();
    for (const item of catalog) {
      if (!selectedIds.has(item.id)) continue;
      const existing = groups.get(item.seller_id);
      if (existing) existing.items.push(item);
      else groups.set(item.seller_id, { seller: item, items: [item] });
    }
    return [...groups.values()];
  }, [catalog, selectedIds]);

  const toggleWishlist = useMutation({
    mutationFn: async (listing: CatalogListing) => {
      if (!user) throw new Error("Entre na sua conta para usar a lista de desejos.");
      if (wishlistIds.has(listing.id)) {
        const { error } = await marketplaceDb
          .from("marketplace_wishlist")
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", listing.id);
        if (error) throw error;
      } else {
        const { error } = await marketplaceDb
          .from("marketplace_wishlist")
          .insert({ user_id: user.id, listing_id: listing.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["marketplace-wishlist"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const createOrder = useMutation({
    mutationFn: async (listingIds: string[]) => {
      if (!user) throw new Error("Entre na sua conta para realizar a compra.");
      const { data, error } = await marketplaceDb.rpc("create_marketplace_order", {
        _listing_ids: listingIds,
        _environment: paymentEnvironment,
      });
      if (error) throw error;
      const result = data as OrderCreateResult;

      // Gera o link antes de abrir o chat. Se a Stripe estiver temporariamente
      // indisponível, o pedido continua no chat e o botão pode gerar outro link.
      try {
        await createMarketplaceCheckout(result.order_id);
      } catch (checkoutError) {
        console.error(checkoutError);
      }
      return result;
    },
    onSuccess: (order) => {
      setSelectedIds(new Set());
      void navigate({
        to: "/social",
        search: { friend: order.seller_id, order: order.order_id, payment: "" },
      });
    },
    onError: (error: DbError) => toast.error(error.message || "Não foi possível criar o pedido."),
  });

  const visibleSellers = sellers.filter((seller) => seller.published_count > 0);
  const activeFilterCount = [nameFilter, authorFilter, categoryFilter, minPrice, maxPrice].filter((value) => value.trim()).length + (typeFilter !== "all" ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || !!sellerFromUrl || !!similarTo;
  const featuredListing = catalog.find((item) => item.cover_url) ?? catalog[0];

  function clearFilters() {
    setNameFilter("");
    setAuthorFilter("");
    setCategoryFilter("");
    setTypeFilter("all");
    setMinPrice("");
    setMaxPrice("");
  }

  function clearAllFilters() {
    clearFilters();
    if (sellerFromUrl || similarTo) {
      void navigate({ to: "/marketplace", search: { seller: "", connect: "", similarTo: "" } });
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return <main className="mx-auto max-w-7xl px-4 py-16">Carregando…</main>;
  }

  return (
    <main className="mx-auto w-full px-3 pb-12 pt-4 sm:px-5 lg:px-8">
      <section
        data-tour="marketplace-intro"
        className="relative isolate overflow-hidden rounded-[1.35rem] border border-border/50 bg-card/55"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_25%,color-mix(in_srgb,var(--accent)_80%,transparent),transparent_54%),linear-gradient(115deg,var(--card),var(--background))]" />
        <div className="relative grid min-h-0 items-center gap-4 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_220px] lg:px-8">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary sm:text-xs">
              <Sparkles className="size-3.5" /> Marketplace BookSyde
            </span>
            <h1 className="mt-3 max-w-xl font-display text-2xl font-semibold leading-[1.08] tracking-tight sm:text-3xl xl:text-4xl">
              Sua próxima história começa por aqui<span className="text-primary">.</span>
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-5 text-muted-foreground">
              Descubra livros, mangás, HQs e coleções digitais publicados por criadores e vendedores.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="lg" className="rounded-xl px-5 shadow-sm">
                <a href="#catalogo-marketplace">Explorar obras <ArrowRight className="size-4" /></a>
              </Button>
              {(isCreator || isSeller || isAdmin) && user ? (
                <SellerActivation
                  status={sellerStatus ?? null}
                  isSeller={!!isSeller || !!isAdmin}
                  activating={activateSeller.isPending}
                  onActivate={() => activateSeller.mutate()}
                  variant="outline"
                />
              ) : (
                <Button asChild size="lg" variant="outline" className="rounded-xl bg-card/75">
                  <a href="#como-funciona-marketplace">Como funciona <ChevronRight className="size-4" /></a>
                </Button>
              )}
            </div>
            {catalog.length > 0 ? (
              <p className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <BookOpen className="size-3.5 text-primary" /> {catalog.length} {catalog.length === 1 ? "publicação disponível" : "publicações disponíveis"} para explorar
              </p>
            ) : null}
          </div>
          <div className="relative hidden h-[150px] items-center justify-center lg:flex" aria-hidden="true">
            <div className="absolute size-36 rounded-full border border-primary/10 bg-primary/5" />
            <div className="absolute size-48 rounded-full border border-dashed border-primary/15" />
            {featuredListing ? (
              <div className="relative w-[98px] -rotate-6 rounded-r-xl border border-border/60 bg-card p-1 shadow-[18px_22px_38px_-17px_rgba(0,0,0,.45)]">
                <div className="aspect-[3/4] overflow-hidden rounded-r-lg">
                  <PublicationCover coverUrl={featuredListing.cover_url} title={featuredListing.title} workType={featuredListing.work_type} className="size-full" />
                </div>
              </div>
            ) : (
              <div className="relative flex -rotate-6 items-end gap-2 drop-shadow-xl">
                <div className="flex h-40 w-20 items-center justify-center rounded-l-sm rounded-r-lg border-l-[9px] border-l-primary/65 border-r-4 border-r-border bg-secondary shadow-lg"><BookOpen className="size-9 text-primary/60" /></div>
                <div className="flex h-48 w-24 items-center justify-center rounded-l-sm rounded-r-lg border-l-[9px] border-l-accent-foreground/55 border-r-4 border-r-border bg-accent shadow-xl"><BookOpen className="size-10 text-accent-foreground/65" /></div>
                <div className="h-36 w-16 rounded-l-sm rounded-r-lg border-l-[9px] border-l-primary/35 border-r-4 border-r-border bg-muted shadow-lg" />
              </div>
            )}
            <span className="absolute bottom-1 right-2 rounded-full border border-border/70 bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-lg">
              <BookOpen className="mr-1.5 inline size-3.5 text-primary" /> Histórias para descobrir
            </span>
          </div>
        </div>
      </section>

      {visibleSellers.length > 0 ? (
        <section data-tour="marketplace-sellers" className="mt-9 sm:mt-11">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Conheça quem publica</p>
              <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Vendedores em destaque</h2>
              <p className="mt-1 text-sm text-muted-foreground">Explore as lojas e descubra novas publicações.</p>
            </div>
            {sellerFromUrl ? (
              <Button variant="outline" size="sm" className="rounded-full" onClick={clearAllFilters}>
                <X className="size-4" /> Limpar vendedor
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleSellers.slice(0, 4).map((seller) => (
              <SellerCard
                key={seller.seller_id}
                seller={seller}
                active={sellerFromUrl === seller.seller_id}
                onCatalog={() => void navigate({ to: "/marketplace/vendedor/$sellerId", params: { sellerId: seller.seller_id } })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {user && wishlistListings.length ? (
        <WishlistSection
          listings={wishlistListings}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
          onRemove={(listing) => toggleWishlist.mutate(listing)}
        />
      ) : null}

      {selectedGroups.length ? (
        <section className="mt-8 rounded-[1.75rem] border border-primary/25 bg-primary/5 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            <h2 className="font-display text-2xl">Sua seleção</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {selectedGroups.map((group) => {
              const total = group.items.reduce((sum, item) => sum + item.price_cents, 0);
              return (
                <div key={group.seller.seller_id} className="rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src={group.seller.seller_avatar_url ?? undefined} />
                      <AvatarFallback>{initials(group.seller.seller_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{group.seller.seller_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.items.length} item{group.items.length === 1 ? "" : "s"} · {formatMarketplacePrice(total)}
                      </p>
                    </div>
                    <Button
                      disabled={createOrder.isPending || group.seller.seller_id === user?.id}
                      onClick={() => createOrder.mutate(group.items.map((item) => item.id))}
                    >
                      {createOrder.isPending ? <Loader2 className="size-4 animate-spin" /> : <WalletCards className="size-4" />}
                      Comprar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}


      <section data-tour="marketplace-catalog" className="mt-7 scroll-mt-24" id="catalogo-marketplace">
        {similarTo ? (
          <div className="mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Search className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">
                  Obras parecidas{similarSourceTitle ? ` com ${similarSourceTitle}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Priorizamos tipo, categoria, autor e gêneros em comum com a obra escolhida no Catálogo.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigate({
                  to: "/marketplace",
                  search: { seller: "", connect: "", similarTo: "" },
                })
              }
            >
              <X className="size-4" /> Ver todo o Marketplace
            </Button>
          </div>
        ) : null}

        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Encontre sua leitura</p>
            <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Obras e coleções</h2>
            <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
              {loadingCatalog ? "Carregando publicações…" : `${filteredCatalog.length} ${filteredCatalog.length === 1 ? "resultado" : "resultados"}${hasActiveFilters ? " para sua busca" : " disponíveis"}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={clearAllFilters}>
                <X className="size-4" /> Limpar filtros
              </Button>
            ) : null}
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="hidden sm:inline">Ordenar</span>
              <select
                aria-label="Ordenar publicações"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as MarketplaceSort)}
                disabled={!!similarTo}
                className="h-10 max-w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="title">Título: A–Z</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filtrar por tipo de publicação">
          {TYPE_FILTERS.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setTypeFilter(type.value)}
              aria-pressed={typeFilter === type.value}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                typeFilter === type.value
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/80 bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="rounded-[1.5rem] border border-border/65 bg-card/85 p-3 shadow-[0_12px_35px_-30px_rgba(0,0,0,.45)] sm:p-4">
          <div className="flex gap-2 lg:hidden">
            <div className="min-w-0 flex-1">
              <FilterInput icon={<Search className="size-4" />} value={nameFilter} onChange={setNameFilter} placeholder="Buscar título ou obra…" label="Buscar pelo título" />
            </div>
            <Button
              type="button"
              variant="outline"
              aria-expanded={showAdvancedFilters}
              aria-controls="marketplace-advanced-filters"
              className="h-10 shrink-0 rounded-xl px-3"
              onClick={() => setShowAdvancedFilters((current) => !current)}
            >
              <SlidersHorizontal className="size-4" /> <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > (nameFilter.trim() ? 1 : 0) ? (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{activeFilterCount - (nameFilter.trim() ? 1 : 0)}</span>
              ) : null}
              <ChevronDown className={cn("size-3.5 transition-transform", showAdvancedFilters && "rotate-180")} />
            </Button>
          </div>
          <div id="marketplace-advanced-filters" className={cn("grid gap-3 lg:grid-cols-6", showAdvancedFilters ? "mt-3 lg:mt-0" : "hidden lg:grid")}>
            <div className="hidden lg:col-span-2 lg:block">
              <FilterInput icon={<Search className="size-4" />} value={nameFilter} onChange={setNameFilter} placeholder="Buscar título ou obra…" label="Buscar pelo título" />
            </div>
            <FilterInput icon={<UserRound className="size-4" />} value={authorFilter} onChange={setAuthorFilter} placeholder="Autor ou autora" label="Filtrar por autor" />
            <label className="relative">
              <span className="sr-only">Categoria</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todas as categorias</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <FilterInput icon={<CircleDollarSign className="size-4" />} value={minPrice} onChange={setMinPrice} placeholder="Preço mín. (R$)" label="Preço mínimo em reais" inputMode="decimal" />
            <FilterInput icon={<CircleDollarSign className="size-4" />} value={maxPrice} onChange={setMaxPrice} placeholder="Preço máx. (R$)" label="Preço máximo em reais" inputMode="decimal" />
          </div>
          {sellerFromUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Exibindo uma loja
              <button type="button" className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-semibold text-primary hover:bg-primary/15" onClick={clearAllFilters}>
                Remover filtro de vendedor <X className="size-3" />
              </button>
            </div>
          ) : null}
        </div>

        {loadingCatalog || loadingSimilar ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="status" aria-label="Carregando publicações">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-border/60 bg-card p-3">
                <div className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
                <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : catalogError ? (
          <div className="mt-5 flex flex-col items-center rounded-[1.5rem] border border-destructive/25 bg-card px-5 py-10 text-center">
            <BookOpen className="size-9 text-primary" />
            <h3 className="mt-3 font-display text-xl font-semibold">Não foi possível carregar o catálogo</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
            <Button type="button" variant="outline" className="mt-5 rounded-xl" onClick={() => void refetchCatalog()}>Tentar novamente</Button>
          </div>
        ) : filteredCatalog.length ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredCatalog.map((listing) => (
              <MarketplaceCard
                key={listing.id}
                listing={listing}
                wished={wishlistIds.has(listing.id)}
                selected={selectedIds.has(listing.id)}
                own={listing.seller_id === user?.id}
                realistic={getCatalogDisplayStyle(catalogDisplayPreferences, listing.work_type) === "realistic"}
                onWish={() => toggleWishlist.mutate(listing)}
                onSelect={() => toggleSelected(listing.id)}
                onSeller={() => void navigate({ to: "/marketplace/vendedor/$sellerId", params: { sellerId: listing.seller_id } })}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-border/65 bg-card/90 px-5 py-10 text-center sm:py-14">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-primary/15 bg-primary/10">
              {hasActiveFilters ? <Search className="size-7 text-primary" /> : <BookOpen className="size-7 text-primary" />}
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold sm:text-2xl">
              {hasActiveFilters ? "Nenhuma obra corresponde à sua busca" : "As primeiras histórias estão a caminho"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {hasActiveFilters
                ? "Tente outra categoria, ajuste a faixa de preço ou remova os filtros para explorar todo o catálogo."
                : "Ainda não há publicações à venda. Enquanto isso, explore as obras disponíveis na biblioteca da plataforma."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {hasActiveFilters ? (
                <Button type="button" className="rounded-xl" onClick={clearAllFilters}><X className="size-4" /> Limpar todos os filtros</Button>
              ) : (
                <Button asChild className="rounded-xl"><Link to="/">Explorar catálogo <ArrowRight className="size-4" /></Link></Button>
              )}
              {!hasActiveFilters && (isCreator || isSeller || isAdmin) && user ? (
                <Button asChild variant="outline" className="rounded-xl"><Link to="/marketplace/vendedor" search={{ connect: "" }}>Ir à central do vendedor</Link></Button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section id="como-funciona-marketplace" className="mt-7 scroll-mt-24 hidden gap-3 rounded-[1.5rem] border border-border/60 bg-card/65 p-4 sm:grid-cols-3 sm:p-6 lg:grid">
        <div className="flex items-start gap-3 p-2"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Search className="size-5" /></div><div><h3 className="font-semibold">Descubra</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Encontre publicações e conheça os criadores.</p></div></div>
        <div className="flex items-start gap-3 p-2"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Heart className="size-5" /></div><div><h3 className="font-semibold">Salve seus favoritos</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Guarde as obras que deseja explorar depois.</p></div></div>
        <div className="flex items-start gap-3 p-2"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShoppingBag className="size-5" /></div><div><h3 className="font-semibold">Compre com sua conta</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Selecione itens e siga para a compra com o vendedor.</p></div></div>
      </section>

    </main>
  );
}

function SellerActivation({
  status,
  isSeller,
  activating,
  onActivate,
  variant = "default",
}: {
  status: SellerRow | null;
  isSeller: boolean;
  activating: boolean;
  onActivate: () => void;
  variant?: "default" | "outline";
}) {
  if (!isSeller) {
    return (
      <Button size="lg" variant={variant} className="rounded-xl bg-card/75" disabled={activating} onClick={onActivate}>
        {activating ? <Loader2 className="size-4 animate-spin" /> : <Store className="size-4" />}
        {activating ? "Iniciando cadastro…" : "Quero me tornar um vendedor"}
      </Button>
    );
  }

  return (
    <Button asChild size="lg" variant={variant} className="rounded-xl bg-card/75">
      <Link to="/marketplace/vendedor" search={{ connect: "" }}>
        {status?.charges_enabled ? <BadgeCheck className="size-4" /> : <Store className="size-4" />}
        Central do vendedor
      </Link>
    </Button>
  );
}

function SellerCard({ seller, active, onCatalog }: { seller: SellerStats; active: boolean; onCatalog: () => void }) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-[1.65rem] border bg-card/95 p-4 transition",
        active
          ? "border-primary/55 shadow-[0_20px_45px_-28px_color-mix(in_srgb,var(--primary)_40%,transparent)]"
          : "border-border/60 hover:border-primary/25 hover:bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12 border border-border/60">
            <AvatarImage src={seller.avatar_url ?? undefined} />
            <AvatarFallback>{initials(seller.display_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold">{seller.display_name}</p>
              {seller.featured ? <BadgeCheck className="size-4 shrink-0 text-primary" /> : null}
            </div>
            <p className="text-xs text-muted-foreground">Perfil há {profileAge(seller.profile_created_at)}</p>
          </div>
        </div>
        {seller.featured ? (
          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Destaque
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Stat value={seller.published_count} label="arquivos publicados" />
        <Stat value={seller.sales_count} label="vendas realizadas" />
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-background/40 px-3 py-2.5 text-xs text-muted-foreground">
        Veja o catálogo completo e filtre os itens deste vendedor no marketplace.
      </div>

      <Button variant={active ? "default" : "outline"} className="mt-4 w-full" onClick={onCatalog}>
        Visualizar catálogo <ChevronRight className="size-4" />
      </Button>
    </article>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/35 px-3 py-3">
      <p className="text-xl font-semibold leading-none">{Number(value ?? 0)}</p>
      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{label}</p>
    </div>
  );
}

function WishlistSection({
  listings,
  selectedIds,
  onToggleSelected,
  onRemove,
}: {
  listings: CatalogListing[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onRemove: (listing: CatalogListing) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { seller: CatalogListing; items: CatalogListing[] }>();
    listings.forEach((listing) => {
      const current = map.get(listing.seller_id);
      if (current) current.items.push(listing);
      else map.set(listing.seller_id, { seller: listing, items: [listing] });
    });
    return [...map.values()];
  }, [listings]);

  return (
    <section className="mt-8 rounded-[1.75rem] border border-border/60 bg-card/70 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Heart className="size-5 fill-primary text-primary" />
        <h2 className="font-display text-2xl">Lista de desejos</h2>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.seller.seller_id} className="rounded-2xl border border-border/60 bg-background/55 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{group.seller.seller_name}</p>
            <div className="space-y-2">
              {group.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-xl bg-muted/45 px-3 py-2">
                  <button
                    type="button"
                    className={cn("size-5 rounded-md border", selectedIds.has(item.id) ? "border-primary bg-primary" : "border-border")}
                    onClick={() => onToggleSelected(item.id)}
                    aria-label={`Selecionar ${item.title}`}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm">{item.title}</p>
                  <span className="text-xs font-semibold">{formatMarketplacePrice(item.price_cents)}</span>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => onRemove(item)} aria-label="Remover dos desejos">
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketplaceCard({
  listing,
  wished,
  selected,
  own,
  realistic,
  onWish,
  onSelect,
  onSeller,
}: {
  listing: CatalogListing;
  wished: boolean;
  selected: boolean;
  own: boolean;
  realistic: boolean;
  onWish: () => void;
  onSelect: () => void;
  onSeller: () => void;
}) {
  const collectionItemCount = listing.target_type === "folder" ? (listing.manga_ids?.length ?? 0) : 0;

  return (
    <article className={cn(
      "group flex h-full flex-col overflow-hidden rounded-[1.35rem] border bg-card/95 shadow-[0_15px_42px_-35px_rgba(0,0,0,.6)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_48px_-30px_rgba(0,0,0,.28)]",
      realistic && "marketplace-realistic-card overflow-visible",
      selected ? "border-primary/60 shadow-lg shadow-primary/5" : "border-border/60 hover:border-border",
    )}>
      <div className={cn("relative aspect-[3/4] overflow-hidden bg-muted", realistic && "marketplace-realistic-stage overflow-visible bg-transparent")}>
        <Link to="/marketplace/item/$listingId" params={{ listingId: listing.id }} className="block size-full" aria-label={`Abrir ${listing.title}`}>
          <PublicationCover coverUrl={listing.cover_url} title={listing.title} workType={listing.work_type}
            className="size-full" />
        </Link>
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-background/85 px-2 py-1 text-[10px] font-semibold backdrop-blur">
          {listing.target_type === "folder" ? "Coleção" : workTypeLabel(listing.work_type)}
        </span>
        <Button type="button" variant="secondary" size="icon" className="absolute right-2 top-2 size-8 rounded-full bg-background/85" onClick={onWish} aria-label={wished ? `Remover ${listing.title} da lista de desejos` : `Adicionar ${listing.title} à lista de desejos`} aria-pressed={wished}>
          <Heart className={cn("size-4", wished && "fill-primary text-primary")} />
        </Button>
        {collectionItemCount > 0 ? (
          <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
            <Boxes className="size-3" />
            {collectionItemCount} {collectionItemCount === 1 ? "item" : "itens"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <button type="button" onClick={onSeller} className="mb-1 flex max-w-full items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <Store className="size-3" /><span className="truncate">{listing.seller_name}</span>
        </button>
        <Link to="/marketplace/item/$listingId" params={{ listingId: listing.id }} className="line-clamp-2 min-h-10 max-h-10 overflow-hidden break-words text-sm font-semibold leading-5 hover:text-primary">{listing.title}</Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">{listing.author || listing.category || "Coleção"}</p>
        {collectionItemCount > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <Boxes className="size-3.5" />
            Ao comprar: acesso a {collectionItemCount} {collectionItemCount === 1 ? "item" : "itens"}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          <span className="text-sm font-bold sm:text-base">{formatMarketplacePrice(listing.price_cents, listing.currency)}</span>
          <Button type="button" size="sm" className="rounded-lg" variant={selected ? "default" : "outline"} disabled={own} onClick={onSelect} aria-pressed={selected}>
            {selected ? "Selecionado" : own ? "Seu item" : "Selecionar"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function FilterInput({ icon, value, onChange, placeholder, label, inputMode }: { icon: ReactNode; value: string; onChange: (value: string) => void; placeholder: string; label: string; inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="h-10 rounded-xl bg-background pl-9" />
    </label>
  );
}

function profileAge(value: string) {
  const created = new Date(value);
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - created.getFullYear()) * 12 + now.getMonth() - created.getMonth());
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "ano" : "anos"}`;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";
}

function workTypeLabel(value: string) {
  if (value === "hq") return "HQ";
  if (value === "book") return "Livro";
  if (value === "gibi") return "Gibi";
  return "Mangá";
}
