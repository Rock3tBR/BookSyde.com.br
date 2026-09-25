import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/contato")({
  validateSearch: (search: Record<string, unknown>): { topic?: string } => ({
    topic:
      search["topic"] === "copyright" ||
      search["topic"] === "payment" ||
      search["topic"] === "seller" ||
      search["topic"] === "refund" ||
      search["topic"] === "privacy"
        ? (search["topic"] as string)
        : "general",
  }),
  head: () => ({ meta: [{ title: "Contato — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/contato"), "ContactPage"),
});
