import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRouter,
  RouterProvider,
  createMemoryHistory,
  Outlet,
} from "@tanstack/react-router";
import { AuthProvider } from "../src/lib/auth";
import { SiteHeader } from "../src/components/SiteHeader";
import { CommunityDock } from "../src/components/CommunityDock";
import { Route as home } from "../src/routes/index";
import { Route as account } from "../src/routes/conta";
import { Route as social } from "../src/routes/social";
import { Route as library } from "../src/routes/biblioteca";
import "../src/styles.css";
const root = createRootRoute({
  component: () => (
    <AuthProvider>
      <SiteHeader />
      <Outlet />
      <CommunityDock />
    </AuthProvider>
  ),
});
const routes = [
  [home, "/"],
  [account, "/conta"],
  [social, "/social"],
  [library, "/biblioteca"],
] as const;
const router = createRouter({
  routeTree: root.addChildren(
    routes.map(([route, path]) =>
      route.update({ getParentRoute: () => root, path, id: path } as never),
    ),
  ),
  history: createMemoryHistory({
    initialEntries: [new URLSearchParams(location.search).get("route") || "/"],
  }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
