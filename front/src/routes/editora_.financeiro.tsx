import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/editora_/financeiro")({
 head: () => ({meta: [{title: "Financeiro — BookSyde"}]}),
 component: lazyRouteComponent(() => import("@/pages/PublisherRoutes"), "PublisherFinancePage"),
});
