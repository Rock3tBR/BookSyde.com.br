import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/editora_/configuracoes")({
 head: () => ({meta: [{title: "Configuracoes — BookSyde"}]}),
 component: lazyRouteComponent(() => import("@/pages/PublisherRoutes"), "PublisherSettingsPage"),
});
