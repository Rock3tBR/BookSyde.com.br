// A definição da rota permanece pequena; a tela só carrega quando acessada.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/compras")({
  head: () => ({ meta: [{ title: "Minhas compras — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/compras"), "PurchasesPage"),
});
