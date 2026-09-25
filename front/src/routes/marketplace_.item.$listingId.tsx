// A definição da rota permanece pequena; a tela só carrega quando acessada.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace_/item/$listingId")({
  head: () => ({ meta: [{ title: "Publicação — Marketplace BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/marketplace_.item.$listingId"), "MarketplaceItemPage"),
});
