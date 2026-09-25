import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/admin"), "AdminUsersRoutePage"),
});
