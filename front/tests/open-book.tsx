import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OpenBookPreview } from "../src/components/OpenBookPreview";
import {
  createRootRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { Route as mangaRoute } from "../src/routes/manga.$slug";
import "../src/styles.css";

const root = createRootRoute();
const router = createRouter({
  routeTree: root.addChildren([
    mangaRoute.update({
      getParentRoute: () => root,
      path: "/manga/$slug",
      id: "/manga/$slug",
    } as never),
  ]),
  history: createMemoryHistory({ initialEntries: ["/manga/a-estrela-do-sul"] }),
});

const params = new URLSearchParams(location.search);
const mode = params.get("mode");
if (params.has("detail")) document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {params.has("detail") ? (
      <RouterProvider router={router} />
    ) : (
      <main
        style={{
          minHeight: "100vh",
          background: params.has("light") ? "#f6f6f6" : "#14161b",
          display: "grid",
          placeItems: "center",
          padding: "20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "1000px" }}>
          <OpenBookPreview
            title="A estrela do sul"
            coverUrl="storage:book/cover.jpg"
            volume={{
              id: "first-volume",
              file_format: mode?.startsWith("epub") ? "epub" : "images",
              page_count: mode?.startsWith("epub") ? 1 : mode === "short" ? 7 : 100,
            }}
          />
        </div>
      </main>
    )}
  </QueryClientProvider>,
);
