import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/anuncios")({
  head: () => ({ meta: [{ title: "Anuncios — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/AdminMarketplaceRoutes"), "AdminMarketListingsPage"),
});
