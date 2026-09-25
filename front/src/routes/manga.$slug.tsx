// Configuração crítica da rota; a interface é carregada apenas ao abrir esta página.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/manga/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search["invite"] === "string" ? (search["invite"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Obra — BookSyde" },
      { name: "description", content: "Detalhes da obra, volumes, avaliações e comentários." },
      { property: "og:title", content: "Obra — BookSyde" },
      { property: "og:description", content: "Detalhes da obra, volumes e avaliações." },
    ],
  }),
  component: lazyRouteComponent(() => import("@/pages/manga.$slug"), "MangaPage"),
});
