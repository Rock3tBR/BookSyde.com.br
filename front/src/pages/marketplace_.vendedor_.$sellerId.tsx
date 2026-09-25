import { Route } from "@/routes/marketplace_.vendedor_.$sellerId";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  Loader2,
  PackageOpen,
  ShoppingBag,
  Store,
  type LucideIcon,
} from "lucide-react";

import { MarketplaceListingCard, type MarketplaceCardListing } from "@/components/MarketplaceListingCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

const db = supabase as any;

type SellerStats = {
  seller_id: string;
  display_name: string;
  avatar_url: string | null;
  profile_created_at: string;
  store_bio: string;
  featured: boolean;
  published_count: number;
  sandbox_sales_count: number;
  live_sales_count: number;
  sandbox_charges_enabled: boolean;
  live_charges_enabled: boolean;
};

export function PublicSellerPage() {
  const { sellerId } = Route.useParams();
  const environment = getStripeEnvironment();
  const salesColumn = environment === "live" ? "live_sales_count" : "sandbox_sales_count";
  const chargesColumn = environment === "live" ? "live_charges_enabled" : "sandbox_charges_enabled";

  const sellerQuery = useQuery({
    queryKey: ["marketplace-public-seller", sellerId, environment],
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_seller_stats")
        .select("*")
        .eq("seller_id", sellerId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SellerStats | null;
    },
  });

  const catalogQuery = useQuery({
    queryKey: ["marketplace-public-seller-catalog", sellerId],
    queryFn: async () => {
      const { data, error } = await db
        .from("marketplace_catalog")
        .select("id,seller_id,seller_name,seller_avatar_url,target_type,title,author,category,work_type,cover_url,price_cents,currency,manga_ids")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as MarketplaceCardListing[];
      const folderIdsMissingItems = rows
        .filter((listing) => listing.target_type === "folder" && !(listing.manga_ids?.length > 0))
        .map((listing) => listing.id);

      if (!folderIdsMissingItems.length) return rows;

      const { data: listingRows } = await db
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

  if (sellerQuery.isLoading || catalogQuery.isLoading) {
    return <main className="mx-auto grid min-h-[55vh] max-w-5xl place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></main>;
  }

  const seller = sellerQuery.data;
  if (!seller) {
    return <main className="mx-auto max-w-xl px-4 py-20 text-center"><Store className="mx-auto size-9 text-muted-foreground" /><h1 className="mt-4 font-display text-3xl">Loja indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Este vendedor não está disponível no Marketplace no momento.</p><Button asChild className="mt-6"><Link to="/marketplace">Voltar ao Marketplace</Link></Button></main>;
  }

  const sales = Number((seller as any)[salesColumn] ?? 0);
  const chargesEnabled = !!(seller as any)[chargesColumn];
  const age = profileAge(seller.profile_created_at);

  return (
    <main className="w-full px-3 pb-24 pt-4 sm:px-5 sm:pt-8 lg:px-8">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/75 p-5 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <Avatar className="size-16 shrink-0 border border-border/70 sm:size-20"><AvatarImage src={seller.avatar_url ?? undefined} /><AvatarFallback>{seller.display_name?.slice(0, 1)?.toUpperCase() || "V"}</AvatarFallback></Avatar>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline"><Store className="mr-1 size-3" /> Vendedor</Badge>{seller.featured ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15"><BadgeCheck className="mr-1 size-3" /> Destaque</Badge> : null}</div><h1 className="mt-3 truncate font-display text-3xl sm:text-4xl">{seller.display_name || "Vendedor"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{seller.store_bio?.trim() || "Criador e vendedor do Marketplace BookSyde."}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <MiniStat icon={CalendarDays} value={age} label="Perfil" />
            <MiniStat icon={PackageOpen} value={String(seller.published_count)} label="Arquivos" />
            <MiniStat icon={ShoppingBag} value={String(sales)} label="Vendas" />
          </div>
        </div>
      </section>

      {!chargesEnabled ? <div className="mt-4 rounded-xl border border-border/70 bg-card/45 p-4 text-xs text-muted-foreground">O catálogo continua visível, mas novas compras podem ficar indisponíveis enquanto o vendedor conclui a configuração de recebimentos.</div> : null}

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Catálogo</p><h2 className="mt-1 font-display text-2xl sm:text-3xl">Publicações deste vendedor</h2></div><Badge variant="outline">{catalogQuery.data?.length ?? 0} item(ns)</Badge></div>
        {catalogQuery.data?.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{catalogQuery.data.map((listing) => <MarketplaceListingCard key={listing.id} listing={listing} compact />)}</div> : <div className="rounded-[1.35rem] border border-dashed border-border/70 py-16 text-center"><PackageOpen className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Nenhum anúncio disponível</p></div>}
      </section>
    </main>
  );
}

function MiniStat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) { return <div className="rounded-xl border border-border/65 bg-background/35 p-3 text-center"><Icon className="mx-auto size-4 text-primary" /><p className="mt-2 truncate text-sm font-semibold">{value}</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p></div>; }
function profileAge(value: string) { const start = new Date(value); const now = new Date(); const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()); if (months < 1) return "Novo"; if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`; const years = Math.floor(months / 12); return `${years} ${years === 1 ? "ano" : "anos"}`; }
