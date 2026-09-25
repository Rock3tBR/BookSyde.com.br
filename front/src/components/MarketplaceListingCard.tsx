import { Link } from "@tanstack/react-router";
import { Boxes, Heart, Package, Store } from "lucide-react";

import { PublicationCover } from "@/components/PublicationCover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMarketplacePrice } from "@/lib/marketplace";

export type MarketplaceCardListing = {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_avatar_url?: string | null;
  target_type: "manga" | "folder";
  title: string;
  author?: string | null;
  category?: string | null;
  work_type?: string | null;
  cover_url?: string | null;
  price_cents: number;
  currency?: string | null;
  manga_ids?: string[] | null;
};

export function MarketplaceListingCard({
  listing,
  wished = false,
  onToggleWishlist,
  compact = false,
}: {
  listing: MarketplaceCardListing;
  wished?: boolean;
  onToggleWishlist?: (listingId: string) => void;
  compact?: boolean;
}) {
  const collectionItemCount = listing.target_type === "folder" ? (listing.manga_ids?.length ?? 0) : 0;

  return (
    <article className="group overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/70 shadow-[0_22px_55px_-38px_rgba(0,0,0,.95)] transition hover:-translate-y-1 hover:border-primary/30">
      <Link
        to="/marketplace/item/$listingId"
        params={{ listingId: listing.id }}
        className="block"
        aria-label={`Abrir ${listing.title}`}
      >
        <div className={cn("relative overflow-hidden bg-muted/60", compact ? "aspect-[4/5]" : "aspect-[7/9]")}> 
          <PublicationCover
            coverUrl={listing.cover_url} workType={listing.work_type}
            title={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
            fallback={
              <div className="grid h-full place-items-center text-muted-foreground">
                {listing.target_type === "folder" ? <Package className="size-10" /> : <Store className="size-10" />}
              </div>
            }
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
          <span className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
            {listing.target_type === "folder" ? "Coleção" : workTypeLabel(listing.work_type)}
          </span>
          {collectionItemCount > 0 ? (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
              <Boxes className="size-3" />
              {collectionItemCount} {collectionItemCount === 1 ? "item" : "itens"}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="space-y-3 p-3.5 sm:p-4">
        <div className="min-w-0">
          <Link
            to="/marketplace/item/$listingId"
            params={{ listingId: listing.id }}
            className="line-clamp-2 min-h-11 max-h-11 overflow-hidden break-words font-display text-lg font-semibold leading-[1.35] hover:text-primary"
          >
            {listing.title}
          </Link>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {listing.author?.trim() || listing.category?.trim() || "Publicação digital"}
          </p>
          {collectionItemCount > 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <Boxes className="size-3.5" />
              Ao comprar, acesso a {collectionItemCount} {collectionItemCount === 1 ? "item" : "itens"}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link
            to="/marketplace/vendedor/$sellerId"
            params={{ sellerId: listing.seller_id }}
            className="flex min-w-0 items-center gap-2 rounded-full pr-2 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Avatar className="size-7 border border-border/70">
              <AvatarImage src={listing.seller_avatar_url ?? undefined} />
              <AvatarFallback>{listing.seller_name?.slice(0, 1)?.toUpperCase() || "V"}</AvatarFallback>
            </Avatar>
            <span className="max-w-[120px] truncate">{listing.seller_name || "Vendedor"}</span>
          </Link>
          <strong className="shrink-0 text-sm">{formatMarketplacePrice(listing.price_cents, listing.currency || "BRL")}</strong>
        </div>

        <div className="flex gap-2">
          <Button asChild className="min-h-10 flex-1 rounded-xl">
            <Link to="/marketplace/item/$listingId" params={{ listingId: listing.id }}>
              Ver detalhes
            </Link>
          </Button>
          {onToggleWishlist ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-10 shrink-0 rounded-xl"
              onClick={() => onToggleWishlist(listing.id)}
              aria-label={wished ? "Remover da lista de desejos" : "Adicionar à lista de desejos"}
            >
              <Heart className={cn("size-4", wished && "fill-current text-primary")} />
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function workTypeLabel(type?: string | null) {
  if (type === "hq") return "HQ";
  if (type === "book") return "Livro";
  if (type === "gibi") return "Gibi";
  return "Mangá";
}
