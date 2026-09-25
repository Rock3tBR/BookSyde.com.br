import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/AdminMarketplaceRoutes"), "AdminMarketOrdersPage"),
});
