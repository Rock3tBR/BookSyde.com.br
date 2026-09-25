import { expect, test } from "@playwright/test";

test("leitor consulta RPC autorizada em vez de colunas privadas da tabela", async ({ page }) => {
  const calls: unknown[] = [];
  await page.route("**/rest/v1/rpc/booksyde_reader_pages", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ json: [{ id: "page", volume_id: "volume", page_index: 0, storage_path: "authorized/0.jpg" }] });
  });
  await page.goto("/tests/browser.html");
  const result = await page.evaluate(async () => {
    const { getReaderPages } = await import("/src/lib/readerPages.ts");
    return getReaderPages(["volume"], 0);
  });
  expect(calls).toEqual([{ p_volume_ids: ["volume"], p_page_index: 0 }]);
  expect(result[0]?.storage_path).toBe("authorized/0.jpg");
});

test("erro de permissão chega à interface em vez de virar lista vazia", async ({ page }) => {
  await page.route("**/rest/v1/rpc/booksyde_reader_pages", (route) => route.fulfill({
    status: 403, json: { code: "42501", message: "Sem permissão", details: null, hint: null },
  }));
  await page.goto("/tests/browser.html");
  const result = await page.evaluate(async () => {
    const { getReaderPages } = await import("/src/lib/readerPages.ts");
    try { await getReaderPages(["volume"]); return null; }
    catch (error) { return { code: (error as { code: string }).code, message: (error as Error).message }; }
  });
  expect(result).toEqual({ code: "42501", message: "Sem permissão" });
});
