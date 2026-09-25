import { test, expect, type Page } from "@playwright/test";

const works = ["book", "manga", "hq", "gibi"].map((type, index) => ({
  id: type,
  slug: type,
  title: `Obra ${type}`,
  work_type: type,
  author: "Autor",
  cover_url: "/tests/cover.svg",
  genres: ["Aventura"],
  price_cents: 0,
  currency: "BRL",
  is_collection: false,
  distribution_channel: "catalog",
  visibility: "public",
  creator_id: "reader",
  view_count: 10,
  status: "completed",
  synopsis: "Uma jornada entre livros e histórias.",
  created_at: `2026-09-0${index + 1}T00:00:00Z`,
}));
const listings = works.map((work) => ({
  ...work,
  id: `listing-${work.id}`,
  seller_id: "seller",
  seller_name: "Livraria",
  target_type: "manga",
  manga_ids: [work.id],
  price_cents: 1000,
  active: true,
}));
listings.push({
  ...listings[0]!,
  id: "collection-listing",
  target_type: "folder",
  title: "Coleção à venda",
  manga_ids: ["book", "manga"],
});
const collection = {
  ...works[0]!,
  id: "collection",
  slug: "collection",
  title: "Sherlock Holmes",
  is_collection: true,
};

async function setup(page: Page, style = "realistic") {
  await page.addInitScript(() => {
    localStorage.setItem(
      "sb-test-auth-token",
      JSON.stringify({
        access_token: "test-token",
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: "reader",
          email: "reader@example.com",
          aud: "authenticated",
          user_metadata: {},
        },
      }),
    );
  });
  await page.route("**/tests/cover.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560"><rect width="420" height="560" fill="#23494e"/><rect x="20" y="20" width="380" height="520" fill="none" stroke="#dfc796" stroke-width="4"/><text x="210" y="240" fill="#dfc796" text-anchor="middle" font-size="38">SHERLOCK</text><text x="210" y="290" fill="#dfc796" text-anchor="middle" font-size="38">HOLMES</text></svg>',
    }),
  );
  await page.route("**/api/reader-pages", (route) =>
    route.fulfill({ status: 403, json: { error: "Preview disabled in fixture" } }),
  );
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop();
    let json: unknown = [];
    if (table === "profiles")
      json = {
        id: "reader",
        display_name: "Leitor",
        theme: "dark",
        book_display_style: style,
        manga_display_style: "grid",
        hq_display_style: "grid",
        gibi_display_style: "grid",
        visible_work_types: ["book", "manga", "hq", "gibi"],
        site_onboarding_completed: true,
      };
    if (table === "profiles" && url.searchParams.get("id")?.startsWith("in."))
      json = [{ id: "seller", display_name: "Livraria" }];
    if (table === "user_roles") json = null;
    if (table === "mangas") {
      const slug = url.searchParams.get("slug");
      json = slug === "eq.collection" ? collection : slug ? works[0] : works;
    }
    if (table === "volumes") {
      json =
        url.searchParams.get("manga_id") === "eq.collection"
          ? [1, 2, 3].map((number) => ({
              id: `volume-${number}`,
              number,
              manga_id: "collection",
              unit_kind: "volume",
              file_format: "epub",
              page_count: 200,
              published: true,
              cover_url: "/tests/cover.svg",
            }))
          : [
              {
                id: "volume-book",
                number: 1,
                manga_id: "book",
                unit_kind: "volume",
                file_format: "epub",
                page_count: 200,
                published: true,
                cover_url: "/tests/cover.svg",
              },
            ];
    }
    if (table === "get_library_workspace")
      json = {
        folders: [{ id: "folder", name: "Minha pasta", color: "#7354d1", creator_id: "reader" }],
        items: works.map((work) => ({
          id: `item-${work.id}`,
          folder_id: work.id === "book" ? "folder" : null,
          manga: work,
        })),
        codes: [],
      };
    if (table === "marketplace_catalog")
      json = url.searchParams.has("id")
        ? listings.find((listing) => `eq.${listing.id}` === url.searchParams.get("id"))
        : listings;
    if (table === "marketplace_seller_stats")
      json = url.searchParams.has("seller_id")
        ? {
            seller_id: "seller",
            display_name: "Livraria",
            published_count: 5,
            profile_created_at: "2026-01-01",
            sandbox_charges_enabled: true,
            live_charges_enabled: true,
          }
        : [];
    if (table === "marketplace_public_sellers")
      json = [
        {
          seller_id: "seller",
          display_name: "Livraria",
          published_count: 5,
          profile_created_at: "2026-01-01",
          sandbox_charges_enabled: true,
          live_charges_enabled: true,
        },
      ];
    if (table === "reading_progress")
      json = [{ volume_id: "volume-book", page_index: 5, completed_at: null }];
    if (table === "marketplace_orders")
      json = [
        {
          id: "order",
          seller_id: "seller",
          status: "paid",
          fulfillment_status: "fulfilled",
          total_cents: 1000,
          currency: "BRL",
          created_at: "2026-09-10",
          paid_at: "2026-09-10",
        },
      ];
    if (table === "marketplace_order_items")
      json = [
        {
          ...works[0],
          id: "order-item",
          order_id: "order",
          target_type: "manga",
          manga_ids: ["book"],
        },
      ];
    await route.fulfill({ json });
  });
}

async function chooseStyle(page: Page, style: string) {
  await page.evaluate(async (style) => {
    const { saveCatalogDisplayPreferences, getCatalogDisplayPreferences } =
      await import("/src/lib/catalogDisplay.ts");
    saveCatalogDisplayPreferences({ ...getCatalogDisplayPreferences(), book: style });
  }, style);
}

for (const width of [390, 1440]) {
  test(`coleção respeita os quatro estilos em ${width}px e mantém ações`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/tests/display-preferences.html?route=/manga/collection");
    const collection = page.locator("#collection-books");
    await expect(collection.locator('[data-display-style="realistic"]')).toHaveCount(3);
    await expect(collection.locator(".realistic-book-model")).toHaveCount(3);
    await expect(collection.getByRole("link", { name: "Ler", exact: true })).toHaveCount(3);
    await expect(
      collection.getByRole("button", { name: "Baixar Livro 1", exact: true }),
    ).toBeVisible();
    await collection.screenshot({ path: `test-results/collection-realistic-${width}.png` });
    for (const style of ["book", "showcase", "grid", "realistic"]) {
      await chooseStyle(page, style);
      await expect(collection.locator(`[data-display-style="${style}"]`)).toHaveCount(3);
      await expect(collection.locator(".realistic-book-model")).toHaveCount(
        style === "realistic" ? 3 : 0,
      );
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

test("livros parecidos seguem o estilo e não forçam Livro", async ({ page }) => {
  await setup(page);
  await page.goto("/tests/display-preferences.html?route=/manga/book");
  const section = page
    .getByRole("heading", { name: "Livros parecidos" })
    .locator("xpath=ancestor::section");
  await expect(
    section.locator('[data-work-type="book"][data-display-style="realistic"]'),
  ).toHaveCount(2);
  await chooseStyle(page, "grid");
  await expect(section.locator('[data-work-type="book"][data-display-style="grid"]')).toHaveCount(
    2,
  );
});

test("biblioteca e conteúdo das pastas respeitam preferências distintas por tipo", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/tests/display-preferences.html?route=/biblioteca");
  await page.getByRole("button", { name: /Minha pasta, 1 item/ }).click();
  await expect(page.locator('[data-work-type="book"][data-display-style="realistic"]')).toHaveCount(
    1,
  );
  await chooseStyle(page, "showcase");
  await expect(page.locator('[data-work-type="book"][data-display-style="showcase"]')).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await expect(page.locator('[data-work-type="manga"][data-display-style="grid"]')).toHaveCount(1);
});

for (const route of [
  "/marketplace",
  "/marketplace/item/collection-listing",
  "/marketplace/vendedor/seller",
  "/compras",
]) {
  test(`preferência aplicada em ${route}`, async ({ page }) => {
    await setup(page);
    await page.goto(`/tests/display-preferences.html?route=${route}`);
    const bookCovers = page.locator('.publication-cover[data-work-type="book"]');
    await expect(bookCovers.first()).toBeVisible();
    for (const style of ["realistic", "grid", "book", "showcase"]) {
      await chooseStyle(page, style);
      await expect(bookCovers.first()).toHaveAttribute("data-display-style", style);
      const otherCovers = page.locator('.publication-cover[data-work-type="manga"]');
      for (const cover of await otherCovers.all())
        await expect(cover).toHaveAttribute("data-display-style", "grid");
    }
  });
}

test("mudança em outra aba se propaga para capas já montadas", async ({ page }) => {
  await setup(page);
  await page.goto("/tests/display-preferences.html?route=/manga/collection");
  await expect(page.locator('#collection-books [data-display-style="realistic"]')).toHaveCount(3);
  await page.evaluate(() => {
    localStorage.setItem(
      "mangaka:catalog-display",
      JSON.stringify({ book: "showcase", manga: "grid", hq: "grid", gibi: "grid" }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "mangaka:catalog-display" }));
  });
  await expect(page.locator('#collection-books [data-display-style="showcase"]')).toHaveCount(3);
});

test("seleção na conta atualiza o estilo sem atualizar componentes durante o render", async ({
  page,
}) => {
  await setup(page, "grid");
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/tests/display-preferences.html?route=/conta");
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  const bookSettings = page
    .getByText("Escolha o estilo usado para livros.")
    .locator("xpath=ancestor::section[1]");
  await bookSettings.getByRole("button", { name: /Realista/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-realistic-experience", "true");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("mangaka:catalog-display")!).book),
  ).toBe("realistic");
  expect(errors.filter((text) => /Cannot update|Maximum update depth/.test(text))).toEqual([]);
});

test("home aplica realismo também a continue lendo e destaques", async ({ page }) => {
  await setup(page);
  await page.goto("/tests/display-preferences.html?route=/");
  await expect(page.locator('.publication-cover[data-work-type="book"]').first()).toHaveAttribute(
    "data-display-style",
    "realistic",
  );
  const continueLink = page
    .locator('a[href="/ler/volume-book"]')
    .filter({ has: page.locator(".publication-cover") })
    .first();
  await expect(continueLink.locator(".realistic-book-model")).toBeVisible();
  await chooseStyle(page, "grid");
  await expect(continueLink.locator(".publication-cover")).toHaveAttribute(
    "data-display-style",
    "grid",
  );
});


test("modo realista usa uma geometria única e só fica em pé no hover desktop", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tests/display-preferences.html?route=/manga/collection");

  const model = page.locator("#collection-books .realistic-book-model").first();
  await expect(model).toBeVisible();
  await expect(model.locator(".closed-book-3d__body")).toHaveCount(1);
  await expect(model.locator(".closed-book-3d__front img")).toHaveCount(1);
  await expect(model.locator(".closed-book-3d__pages")).toHaveCount(3);
  await expect(model.locator(".closed-book-3d__spine")).toHaveCount(1);

  const body = model.locator(".closed-book-3d__body");
  const restingTransform = await body.evaluate((element) => getComputedStyle(element).transform);
  await model.hover();
  await expect.poll(() => body.evaluate((element) => getComputedStyle(element).transform), {
    timeout: 1500,
  }).not.toBe(restingTransform);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(550);
  const mobileTransform = await body.evaluate((element) => getComputedStyle(element).transform);
  await model.hover();
  await page.waitForTimeout(550);
  expect(await body.evaluate((element) => getComputedStyle(element).transform)).toBe(mobileTransform);
});
