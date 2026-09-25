// Configuração crítica da rota; a interface é carregada apenas ao abrir esta página.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BookSyde — biblioteca digital" },
      {
        name: "description",
        content: "Mangás, HQs, gibis e livros com leitor imersivo e leitura gratuita.",
      },
      { property: "og:title", content: "BookSyde — biblioteca digital" },
      {
        property: "og:description",
        content: "Mangás, HQs, gibis e livros com leitor imersivo e leitura gratuita.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/pages/index"), "Index"),
});
