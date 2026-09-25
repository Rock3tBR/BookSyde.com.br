import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/doacoes")({
  head: () => ({ meta: [{ title: "Doacoes — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/admin"), "AdminDonationsRoutePage"),
});
