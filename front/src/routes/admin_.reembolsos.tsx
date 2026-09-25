import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/reembolsos")({
  head: () => ({ meta: [{ title: "Reembolsos — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/AdminMarketplaceRoutes"), "AdminMarketRefundsPage"),
});
