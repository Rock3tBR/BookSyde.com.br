import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";


export const Route = createFileRoute("/studio")({
  validateSearch: (search: Record<string, unknown>) => ({
    obra: typeof search["obra"] === "string" ? search["obra"] : "",
    aba:
      search["aba"] === "volumes" || search["aba"] === "criar"
        ? search["aba"]
        : "obras",
  }),
  head: () => ({ meta: [{ title: "Estúdio — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/StudioRoutePage"), "StudioPage"),
});

