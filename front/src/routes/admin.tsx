// Configuração crítica da rota; a interface é carregada apenas ao abrir esta página.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    obra: typeof search["obra"] === "string" ? (search["obra"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Administração — BookSyde" },
      { name: "description", content: "Gerencie usuários, moderação e configurações do sistema." },
      { property: "og:title", content: "Administração — BookSyde" },
      { property: "og:description", content: "Cadastro de obras e volumes." },
    ],
  }),
  component: lazyRouteComponent(() => import("@/pages/admin"), "AdminPage"),
});
