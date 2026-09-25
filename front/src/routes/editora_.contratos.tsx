import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/editora_/contratos")({
 head: () => ({meta: [{title: "Contratos — BookSyde"}]}),
 component: lazyRouteComponent(() => import("@/pages/PublisherRoutes"), "PublisherContractsPage"),
});
