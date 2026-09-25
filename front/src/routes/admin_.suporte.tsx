import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/suporte")({
  head: () => ({ meta: [{ title: "Suporte — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/AdminMarketplaceRoutes"), "AdminMarketSupportPage"),
});
