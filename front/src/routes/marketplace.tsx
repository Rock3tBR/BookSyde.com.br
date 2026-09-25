// Configuração crítica da rota; a interface é carregada apenas ao abrir esta página.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { seller?: string; connect?: string; similarTo?: string } => ({
    seller: typeof search["seller"] === "string" ? search["seller"] : "",
    connect: typeof search["connect"] === "string" ? search["connect"] : "",
    similarTo: typeof search["similarTo"] === "string" ? search["similarTo"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Marketplace — BookSyde" },
      {
        name: "description",
        content: "Descubra obras, coleções e criadores no marketplace do BookSyde.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/pages/marketplace"), "MarketplacePage"),
});
