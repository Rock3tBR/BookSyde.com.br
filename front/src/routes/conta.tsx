// A definição da rota permanece pequena; a tela só carrega quando acessada.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/conta")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search["tab"] === "catalog" || search["tab"] === "profile" || search["tab"] === "security"
        ? search["tab"]
        : "reading",
  }),
  head: () => ({ meta: [{ title: "Personalização — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/conta"), "AccountPage"),
});
