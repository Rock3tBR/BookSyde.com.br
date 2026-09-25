import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const book = zipSync({
  mimetype: strToU8("application/epub+zip"),
  "META-INF/container.xml": strToU8('<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>'),
  "book.opf": strToU8('<package><manifest><item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>'),
  "a.xhtml": strToU8("<html><body><h1>Primeiro capítulo offline</h1><p>Início do livro.</p></body></html>"),
  "b.xhtml": strToU8("<html><body><h1>Último capítulo offline</h1><p>Final do livro completo.</p></body></html>"),
});

for (const direct of [false, true]) {
  test(`livro completo abre offline ${direct ? "pela rota" : "pela biblioteca"} após recarregar`, async ({ page }) => {
    await page.route("**/api/reader-pages", route => route.fulfill({ json: { url: "/test-book.epub" } }));
    await page.route("**/test-book.epub", route => route.fulfill({ body: Buffer.from(book), contentType: "application/epub+zip" }));
    await page.goto("/tests/offline.html");
    await page.evaluate(async () => {
      Object.defineProperty(navigator.serviceWorker, "ready", { value: Promise.resolve(), configurable: true });
      const { downloadVolumeOffline, getOfflineVolume } = await import("/src/lib/offlineVolumes.ts");
      await downloadVolumeOffline({
        volumeId: "offline-book", volumeNumber: 1, mangaId: "book", mangaSlug: "book",
        mangaTitle: "Livro de teste", workType: "book", fileFormat: "epub",
      });
      if (getOfflineVolume("offline-book")?.fileFormat !== "epub") throw new Error("Download não salvo");
    });
    await page.addInitScript(() => Object.defineProperty(navigator, "onLine", { get: () => false }));
    const remoteRequests: string[] = [];
    await page.route("**/*", async route => {
      if (new URL(route.request().url()).hostname.includes("supabase") || route.request().url().includes("/api/")) {
        remoteRequests.push(route.request().url());
        await route.abort();
      } else await route.fallback();
    });
    await page.goto("/tests/offline.html" + (direct ? "?route=/ler/offline-book" : ""));
    if (!direct) {
      await expect(page.getByText("Livro completo").first()).toBeVisible();
      await page.getByRole("button", { name: /Livro de teste/ }).first().click();
    }
    const content = page.frameLocator("iframe").locator("body");
    await expect(content).toContainText("Primeiro capítulo offline");
    await expect(content).toContainText("Último capítulo offline");
    expect(remoteRequests).toEqual([]);
    if (!direct) {
      await page.getByRole("button", { name: "Fechar leitura", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Ler offline", exact: true })).toBeVisible();
    }
  });
}
