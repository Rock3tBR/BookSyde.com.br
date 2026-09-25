// A definição da rota permanece pequena; a tela só carrega quando acessada.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
type LibraryTabValue = "all" | "progress" | "completed" | "favorites" | "creations";


export const Route = createFileRoute("/biblioteca")({
  validateSearch: (search: Record<string, unknown>): { tab?: LibraryTabValue } => ({
    tab:
      search["tab"] === "progress" ||
      search["tab"] === "completed" ||
      search["tab"] === "favorites" ||
      search["tab"] === "creations"
        ? search["tab"]
        : "all",
  }),
  head: () => ({ meta: [{ title: "Biblioteca — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/biblioteca"), "LibraryPage"),
});
