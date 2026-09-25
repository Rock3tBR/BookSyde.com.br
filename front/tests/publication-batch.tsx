import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "../src/lib/auth";
import { AdminWorkspace } from "../src/pages/admin";
import "../src/styles.css";
const root = createRootRoute({
  component: () => (
    <AuthProvider>
      <AdminWorkspace mode="studio" initialTab="mangas" />
      <Toaster />
    </AuthProvider>
  ),
});
const router = createRouter({
  routeTree: root,
  history: createMemoryHistory({ initialEntries: ["/"] }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
