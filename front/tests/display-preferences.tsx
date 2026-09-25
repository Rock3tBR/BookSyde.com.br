import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { AuthProvider, PreferencesSync } from "../src/lib/auth";
import { RealisticExperienceBridge } from "../src/components/RealisticExperienceBridge";
import { Route as manga } from "../src/routes/manga.$slug";
import { Route as library } from "../src/routes/biblioteca";
import { Route as marketplace } from "../src/routes/marketplace";
import { Route as item } from "../src/routes/marketplace_.item.$listingId";
import { Route as seller } from "../src/routes/marketplace_.vendedor_.$sellerId";
import { Route as home } from "../src/routes/index";
import { Route as account } from "../src/routes/conta";
import { Route as purchases } from "../src/routes/compras";
import "../src/styles.css";

const root = createRootRoute({
  component: () => (
    <AuthProvider>
      <PreferencesSync />
      <RealisticExperienceBridge />
      <Outlet />
    </AuthProvider>
  ),
});
const router = createRouter({
  routeTree: root.addChildren(
    [
      [manga, "/manga/$slug"],
      [library, "/biblioteca"],
      [marketplace, "/marketplace"],
      [item, "/marketplace/item/$listingId"],
      [seller, "/marketplace/vendedor/$sellerId"],
      [home, "/"],
      [purchases, "/compras"],
      [account, "/conta"],
    ].map(([route, path]) =>
      (route as typeof manga).update({ getParentRoute: () => root, path, id: path } as never),
    ),
  ),
  history: createMemoryHistory({
    initialEntries: [new URLSearchParams(location.search).get("route") || "/manga/collection"],
  }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
