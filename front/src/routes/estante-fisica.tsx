import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/estante-fisica")({
  head: () => ({ meta: [{ title: "Minha estante física — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/estante-fisica"), "PhysicalShelfPage"),
});
