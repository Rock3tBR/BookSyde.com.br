// Configuração crítica da rota; a interface é carregada apenas ao abrir esta página.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/social")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { friend?: string; order?: string; payment?: string } => ({
    friend: typeof search["friend"] === "string" ? (search["friend"] as string) : "",
    order: typeof search["order"] === "string" ? (search["order"] as string) : "",
    payment: typeof search["payment"] === "string" ? (search["payment"] as string) : "",
  }),
  head: () => ({ meta: [{ title: "Amigos e conversas — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/social"), "SocialPage"),
});
