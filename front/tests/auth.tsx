import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthPage } from "../src/pages/auth";
import "../src/styles.css";

const root = createRootRoute();
const auth = createRoute({ getParentRoute: () => root, path: "/auth", component: AuthPage });
const router = createRouter({
  routeTree: root.addChildren([auth]),
  history: createMemoryHistory({ initialEntries: ["/auth"] }),
});
createRoot(document.getElementById("root")!).render(
  <>
    <RouterProvider router={router} />
    <Toaster />
  </>,
);
