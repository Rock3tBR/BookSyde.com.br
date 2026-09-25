// Vendedor: rota leve; tela compartilhada carregada sob demanda.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace_/vendedor")({
  validateSearch: (search: Record<string, unknown>): { connect?: string } => ({
    connect: typeof search["connect"] === "string" ? search["connect"] : "",
  }),
  head: () => ({ meta: [{ title: "Central do vendedor — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/marketplace_.vendedor"), "SellerOverviewRoutePage"),
});
