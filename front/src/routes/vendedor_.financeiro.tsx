import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/vendedor_/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/marketplace_.vendedor"), "SellerFinanceRoutePage"),
});
