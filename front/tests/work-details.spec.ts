import { expect, test } from "@playwright/test";

const work = {
  id: "30000000-0000-4000-8000-000000000010",
  slug: "obra-teste",
  title: "Obra de teste",
  author: "Autora de teste",
  synopsis: "Sinopse da obra de teste",
  category: "Aventura",
  cover_url: null,
  genres: [],
  price_cents: 0,
  currency: "BRL",
  status: "ongoing",
  creator_id: "owner",
  visibility: "public",
  work_type: "manga",
  is_collection: false,
  distribution_channel: "catalog",
  catalog_sale_enabled: false,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
});

test("detalhes carregam sem consultar campos privados", async ({ page }) => {
  let privateQuery = false;
  await page.route("**/rest/v1/mangas?**", async (route) => {
    const select = new URL(route.request().url()).searchParams.get("select") ?? "";
    if (/licensed_purchase_url|licensed_store_name|invite_token/.test(select)) {
      privateQuery = true;
      await route.fulfill({
        status: 403,
        json: { code: "42501", message: "permission denied for table mangas" },
      });
      return;
    }
    await route.fulfill({ json: work });
  });
  await page.goto("/tests/work-details.html");
  await expect(page.getByRole("heading", { name: work.title, exact: true })).toBeVisible();
  await expect(page.getByText("Carregando…", { exact: true })).toHaveCount(0);
  expect(privateQuery).toBe(false);
});

test("erro de permissão sai do carregamento e permite tentar novamente", async ({ page }) => {
  let attempts = 0;
  await page.route("**/rest/v1/mangas?**", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({
        status: 403,
        json: { code: "42501", message: "Sem permissão para consultar esta obra" },
      });
    else await route.fulfill({ json: work });
  });
  await page.goto("/tests/work-details.html");
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar os detalhes");
  await expect(page.getByText("Carregando…", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("heading", { name: work.title, exact: true })).toBeVisible();
});

test("obra ausente mostra indisponibilidade em vez de carregamento infinito", async ({ page }) => {
  await page.route("**/rest/v1/mangas?**", (route) => route.fulfill({ json: null }));
  await page.goto("/tests/work-details.html");
  await expect(page.getByRole("heading", { name: "Obra indisponível" })).toBeVisible();
  await expect(page.getByText("Carregando…", { exact: true })).toHaveCount(0);
});

test("convite sem sessão orienta login sem consultar a obra", async ({ page }) => {
  let queried = false;
  await page.route("**/rest/v1/mangas?**", (route) => {
    queried = true;
    return route.fulfill({ json: null });
  });
  await page.goto("/tests/work-details.html?invite=test-invite");
  await expect(page.getByRole("heading", { name: "Você recebeu um convite" })).toBeVisible();
  expect(queried).toBe(false);
});

for (const width of [390, 1280, 1920]) {
  test(`sinopse longa fica proporcional e pode ser lida na íntegra em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const synopsis =
      "Uma longa descrição desta obra, com detalhes sobre a história e seus personagens. ".repeat(
        100,
      );
    await page.route("**/rest/v1/mangas?**", (route) =>
      route.fulfill({ json: { ...work, work_type: "book", synopsis } }),
    );
    await page.goto("/tests/work-details.html");
    const preview = page.locator("[data-synopsis-preview]:visible");
    await expect(preview).toHaveCount(1);
    expect((await preview.textContent())!.length).toBeLessThanOrEqual(321);
    const dimensions = await preview.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
    }));
    expect(dimensions.height).toBeLessThanOrEqual(dimensions.lineHeight * 4 + 1);
    await expect(page.getByRole("heading", { name: work.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ler sinopse completa" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("p").last()).toHaveText(synopsis.trim());
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

test("card mostra paginação pessoal do EPUB sem alterar o volume compartilhado", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("booksyde:reader:guest:layouts", JSON.stringify({
    "personal-volume": { pageCount: 1300, pageIndex: 649, updatedAt: Date.now() },
  })));
  await page.route("**/rest/v1/mangas?**", route => route.fulfill({ json: work }));
  let volumeWrites = 0;
  await page.route("**/rest/v1/volumes?**", route => {
    if (route.request().method() !== "GET") volumeWrites++;
    return route.fulfill({ json: [{ id: "personal-volume", number: 1, unit_kind: "volume", file_format: "epub", page_count: 500, published: true, cover_url: null }] });
  });
  await page.goto("/tests/work-details.html");
  await expect(page.getByText(/^1300 páginas/)).toBeVisible();
  expect(volumeWrites).toBe(0);
});
