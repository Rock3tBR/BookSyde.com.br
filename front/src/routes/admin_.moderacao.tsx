import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/moderacao")({
  head: () => ({ meta: [{ title: "Moderacao — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/admin"), "AdminModerationRoutePage"),
});
