import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/vendedor")({ head: () => ({ meta: [{ title: "Minha loja — BookSyde" }] }), component: lazyRouteComponent(() => import("@/pages/marketplace_.vendedor"), "SellerOverviewRoutePage") });
