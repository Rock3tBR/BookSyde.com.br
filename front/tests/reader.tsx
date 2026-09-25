import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EpubReader } from "../src/components/EpubReader";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Route as readerRoute } from "../src/routes/ler.$volumeId";
import "../src/styles.css";

const volumeId = new URLSearchParams(location.search).get("book") || "reader-test";
const images = new URLSearchParams(location.search).has("images");
const scanned = new URLSearchParams(location.search).has("scanned");
const pdf = new URLSearchParams(location.search).has("pdf");
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
if (!new URLSearchParams(location.search).has("uncached")) client.setQueryData(["epub-content", volumeId, undefined], {
  volume: {
    number: 1,
    unit_kind: "volume",
    mangas: { title: "Livro de teste", slug: "livro", work_type: "book" },
  },
  book: {
    kind: images ? "images" : "text",
    sections: images
      ? Array.from({ length: 12 }, (_, i) => ({
          title: `Página ${i + 1}`,
          html: `<div class="epub-manga-page"><img alt="Página ${i + 1}" src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect width="390" height="844" fill="#f7e8b8"/><text x="40" y="200" font-size="32">Página ${i + 1}</text></svg>`)}" /></div>`,
        }))
      : [
          {
            title: "O viajante",
            html: `<h1>O viajante</h1>${Array.from({ length: 180 }, (_, i) => `<p>Parágrafo ${i + 1}. O viajante percorreu as montanhas, encontrou uma biblioteca e abriu um livro. Cada página guardava histórias das pessoas que passaram por aquele lugar.</p>`).join("")}`,
          },
        ],
  },
});
const root = createRootRoute();
const router = createRouter({
  routeTree: root.addChildren([
    readerRoute.update({
      getParentRoute: () => root,
      path: "/ler/$volumeId",
      id: "/ler/$volumeId",
    } as never),
  ]),
  history: createMemoryHistory({ initialEntries: ["/ler/reader-test"] }),
});
if (scanned) {
  localStorage.setItem("mangaka-reader-onboarding", "done");
  const pages = Array.from({ length: 12 }, (_, i) => ({
    id: `page-${i}`,
    page_index: i,
    storage_path: `book/${i}.svg`,
  }));
  const urls = Object.fromEntries(
    pages.map((_, i) => [
      i,
      `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect width="390" height="844" fill="#f7e8b8"/><text x="40" y="200" font-size="32">Página ${i + 1}</text></svg>`)}`,
    ]),
  );
  client.setQueryData(["publication-format", "reader-test"], { file_format: "images" });
  client.setQueryData(["volume", "reader-test"], {
    id: "reader-test",
    number: 1,
    unit_kind: "volume",
    manga_id: "book",
    mangas: { title: "Livro digitalizado", slug: "livro", work_type: "book" },
  });
  client.setQueryData(["pages", "reader-test"], pages);
  client.setQueryData(["signed-pages", "reader-test", 0, false], urls);
  client.setQueryData(["next-volume", "book", 1, "volume"], null);
}
if (pdf) client.setQueryData(["publication-format", "reader-test"], { file_format: "pdf", isDrive: true });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    {scanned || pdf ? (
      <RouterProvider router={router} />
    ) : (
      <EpubReader volumeId={volumeId} onClose={() => {}} />
    )}
  </QueryClientProvider>,
);
