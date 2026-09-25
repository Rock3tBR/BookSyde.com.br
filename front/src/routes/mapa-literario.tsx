// Configuração crítica da rota; a interface é carregada apenas ao abrir esta página.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/mapa-literario")({
  head: () => ({
    meta: [
      { title: "Mapa Literário — BookSyde" },
      {
        name: "description",
        content: "Descubra e compartilhe sebos, livrarias e lojas indicadas pela comunidade.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/pages/mapa-literario"), "LiteraryMapPage"),
});
