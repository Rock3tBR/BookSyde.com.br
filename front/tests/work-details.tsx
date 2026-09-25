import "../src/styles.css";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRouter, RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { Route as details } from "../src/routes/manga.$slug";
const root = createRootRoute();
const route = details.update({ getParentRoute: () => root, path: "/manga/$slug", id: "/manga/$slug" } as never);
const router = createRouter({
  routeTree: root.addChildren([route]),
  history: createMemoryHistory({ initialEntries: ["/manga/obra-teste" + window.location.search] }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
