import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/editora_/relatorios")({
 head: () => ({meta: [{title: "Relatorios — BookSyde"}]}),
 component: lazyRouteComponent(() => import("@/pages/PublisherRoutes"), "PublisherReportsPage"),
});
