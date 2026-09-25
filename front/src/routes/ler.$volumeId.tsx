// Configuração crítica da rota; a interface é carregada apenas ao abrir esta página.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/ler/$volumeId")({
  head: () => ({
    meta: [
      { title: "Leitor — BookSyde" },
      { name: "description", content: "Leia seu mangá página a página no leitor BookSyde." },
      { property: "og:title", content: "Leitor — BookSyde" },
      { property: "og:description", content: "Leitor de mangá página a página." },
    ],
  }),
  component: lazyRouteComponent(() => import("@/pages/ler.$volumeId"), "PublicationReader"),
});
