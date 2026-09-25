import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/vendedor_/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/marketplace_.vendedor"), "SellerOrdersRoutePage"),
});
