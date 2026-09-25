import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/admin"), "AdminDashboardRoutePage"),
});
