import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/editora")({ head: () => ({meta: [{title: "Gestão editorial — BookSyde"}]}),component: lazyRouteComponent(() => import("@/pages/PublisherRoutes"), "PublisherOverviewPage") });
