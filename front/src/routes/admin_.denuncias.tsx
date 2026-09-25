import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/denuncias")({
  head: () => ({ meta: [{ title: "Denuncias — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/AdminMarketplaceRoutes"), "AdminMarketReportsPage"),
});
