// A definição da rota permanece pequena; a tela só carrega quando acessada.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/planos")({
  head: () => ({ meta: [{ title: "Planos — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/planos"), "PlansPage"),
});
