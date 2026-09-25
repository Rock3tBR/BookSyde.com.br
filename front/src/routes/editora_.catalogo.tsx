import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/editora_/catalogo")({
 head: () => ({meta: [{title: "Catalogo — BookSyde"}]}),
 component: lazyRouteComponent(() => import("@/pages/PublisherRoutes"), "PublisherCatalogPage"),
});
