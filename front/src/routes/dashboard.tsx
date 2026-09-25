import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/dashboard"), "DashboardPage"),
});
