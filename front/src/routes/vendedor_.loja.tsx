import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/vendedor_/loja")({
  head: () => ({ meta: [{ title: "Loja — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/marketplace_.vendedor"), "SellerStoreRoutePage"),
});
