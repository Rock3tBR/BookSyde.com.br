import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRouter, RouterProvider, createMemoryHistory, Outlet } from "@tanstack/react-router";
import { OfflineGate } from "../src/components/OfflineMode";
import { Route as reader } from "../src/routes/ler.$volumeId";
const root = createRootRoute({ component: () => <OfflineGate><Outlet /></OfflineGate> });
const router = createRouter({
  routeTree: root.addChildren([reader.update({ getParentRoute: () => root, path: "/ler/$volumeId", id: "/ler/$volumeId" } as never)]),
  history: createMemoryHistory({ initialEntries: [new URLSearchParams(location.search).get("route") || "/"] }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
