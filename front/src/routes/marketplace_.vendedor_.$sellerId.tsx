// A definição da rota permanece pequena; a tela só carrega quando acessada.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace_/vendedor_/$sellerId")({
  head: () => ({ meta: [{ title: "Vendedor — Marketplace BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/marketplace_.vendedor_.$sellerId"), "PublicSellerPage"),
});
