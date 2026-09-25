import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/vendedor_/publicacoes")({
  head: () => ({ meta: [{ title: "Publicacoes — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/marketplace_.vendedor"), "SellerListingsRoutePage"),
});
