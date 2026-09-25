import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560"><rect width="420" height="560" fill="#163b43"/><rect x="24" y="24" width="372" height="512" rx="3" fill="none" stroke="#cbb278" stroke-width="2"/><text x="210" y="90" text-anchor="middle" fill="#e9d8ab" font-size="22" font-family="Georgia">JÚLIO VERNE</text><path d="M50 415L155 215L240 330L305 240L385 415Z" fill="#ad996b"/><path d="M155 215L124 277L159 262L192 280Z" fill="#eddfb9"/><circle cx="280" cy="180" r="32" fill="#d8c597"/><text x="210" y="466" text-anchor="middle" fill="#eee0ba" font-family="Georgia" font-size="30">A ESTRELA DO SUL</text><text x="210" y="504" text-anchor="middle" fill="#cbb278" font-size="12">CAPA DE TESTE</text></svg>`;
const pageTen = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560"><rect width="420" height="560" fill="#faf5e9"/><text x="210" y="45" text-anchor="middle" font-family="Georgia" font-size="13">A ESTRELA DO SUL</text><text x="50" y="95" font-family="Georgia" font-size="22">Página dez do arquivo</text>${Array.from({ length: 23 }, (_, i) => `<text x="50" y="${128 + i * 15}" font-family="Georgia" font-size="10">${i % 4 === 3 ? "Uma página de teste para conferir a curvatura." : "O viajante contemplou as montanhas ao longe."}</text>`).join("")}<text x="210" y="527" text-anchor="middle" font-family="Georgia" font-size="14">10</text></svg>`;

test.beforeEach(async ({ page }) => {
  // Uploaded covers/pages are bitmap files. Rasterize the drawn fixtures too.
  const rasterize = async (svg: string) =>
    Buffer.from(
      await page.evaluate(async (source) => {
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 420;
        canvas.height = 560;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1]!;
      }, svg),
      "base64",
    );
  const coverPng = await rasterize(cover);
  const pagePng = await rasterize(pageTen);
  await page.route("**/storage/v1/object/sign/manga-covers/**", (route) =>
    route.fulfill({ json: { signedURL: "/object/sign/manga-covers/book/cover.jpg?token=test" } }),
  );
  await page.route("**/storage/v1/object/sign/manga-covers/**?token=test", (route) =>
    route.fulfill({ contentType: "image/png", body: coverPng }),
  );
  await page.route("**/rest/v1/pages?**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("page_index")).toBe("eq.9");
    expect(url.searchParams.get("volume_id")).toBe("eq.first-volume");
    await route.fulfill({ json: { storage_path: "book/first-volume/009.webp" } });
  });
  await page.route("**/api/reader-pages", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      volumeId: "first-volume",
      paths: ["book/first-volume/009.webp"],
    });
    await route.fulfill({
      json: { urls: { "book/first-volume/009.webp": "/tests/page-ten.svg" } },
    });
  });
  await page.route("**/tests/page-ten.svg", (route) =>
    route.fulfill({ contentType: "image/png", body: pagePng }),
  );
});

test("capa privada à esquerda e décima página real à direita", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.goto("/tests/open-book.html");
  const left = page.locator('[data-book-sheet="left"] image');
  const right = page.locator('[data-book-sheet="right"] image');
  await expect(left).toHaveAttribute("href", /manga-covers\/book\/cover.jpg\?token=test/);
  await expect(right).toHaveAttribute("href", "/tests/page-ten.svg");
  await expect(page.locator("svg text")).toHaveCount(0);
  await page.screenshot({ path: "test-results/open-book-dark.png" });
  await page.goto("/tests/open-book.html?light");
  await expect(page.locator('[data-book-sheet="right"] image')).toHaveCount(1);
  await page.screenshot({ path: "test-results/open-book-light.png" });
});

for (const [mode, message] of [["short", "Arquivo com menos de 10 páginas"]]) {
  test(`não inventa página para ${mode}`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/rest/v1/pages") || request.url().includes("/api/reader-pages"))
        requests.push(request.url());
    });
    await page.goto(`/tests/open-book.html?mode=${mode}`);
    await expect(page.locator('[data-book-sheet="right"] text')).toHaveText(message!);
    await expect(page.locator('[data-book-sheet="left"] image')).toHaveCount(1);
    expect(requests).toEqual([]);
  });
}

test("falhas de imagem e acesso usam estados honestos", async ({ page }) => {
  await page.route("**/api/reader-pages", (route) =>
    route.fulfill({ status: 403, json: { error: "Sem acesso" } }),
  );
  await page.route("**/storage/v1/object/sign/manga-covers/**?token=test", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/tests/open-book.html");
  await expect(page.locator('[data-book-sheet="right"] text')).toHaveText("Prévia indisponível");
  await expect(page.locator('[data-book-sheet="left"] text')).toHaveText("Capa indisponível");
  await expect(page.locator("svg image")).toHaveCount(0);
});

for (const width of [390, 640]) {
  test(`modelo cabe em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/tests/open-book.html");
    await expect(page.locator('[data-book-sheet="right"] image')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `test-results/open-book-${width}.png` });
  });
}

for (const width of [1024, 1440]) {
  test(`livro completo na tela de detalhes em ${width}px`, async ({ page }) => {
    const renderErrors: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Maximum update depth")) renderErrors.push(message.text());
    });
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() =>
      localStorage.setItem("mangaka:catalog-display", JSON.stringify({ book: "realistic" })),
    );
    await page.route("**/rest/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const table = url.pathname.split("/").pop();
      if (table === "pages" && url.searchParams.get("page_index") === "eq.9")
        return route.fallback();
      const manga = {
        id: "book",
        slug: "a-estrela-do-sul",
        title: "A estrela do sul",
        author: "Júlio Verne",
        work_type: "book",
        is_collection: false,
        visibility: "public",
        distribution_channel: "catalog",
        price_cents: 0,
        currency: "BRL",
        cover_url: "storage:book/cover.jpg",
        genres: [],
        synopsis:
          "O engenheiro Cyprien Méré viaja à África do Sul, onde se envolve com a exploração de diamantes e se apaixona por Alice Watkins.",
        status: "completed",
      };
      let json: unknown = [];
      if (table === "mangas" && url.searchParams.has("slug")) json = manga;
      if (table === "volumes")
        json = [
          {
            id: "first-volume",
            number: 1,
            unit_kind: "volume",
            file_format: "images",
            page_count: 100,
            published: true,
            cover_url: null,
          },
        ];
      if (table === "volumes") await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({ json });
    });
    await page.goto("/tests/open-book.html?detail");
    const model = page.locator(".open-book-stage");
    await expect(model).toBeVisible();
    await expect(model.locator('[data-book-sheet="right"] image')).toHaveAttribute(
      "href",
      "/tests/page-ten.svg",
    );
    const bounds = await model.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await model
      .locator("xpath=ancestor::section")
      .screenshot({ path: `test-results/open-book-detail-${width}.png` });
    expect(renderErrors).toEqual([]);
  });
}

function epubFixture(sectionCount = 12) {
  const sections = Array.from({ length: sectionCount }, (_, index) => ({
    id: `section-${index}`,
    title: `Capítulo ${index + 1}`,
    text:
      index === 9
        ? "Este é o trecho verdadeiro da décima página. Jonathan avistou o castelo entre as montanhas."
        : `Trecho original da seção ${index + 1}. O viajante continuou a jornada.`,
  }));
  return Buffer.from(
    zipSync({
      mimetype: strToU8("application/epub+zip"),
      "META-INF/container.xml": strToU8(
        '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
      ),
      "OPS/book.opf": strToU8(
        `<package><manifest>${[...sections]
          .reverse()
          .map(
            (s) => `<item id="${s.id}" href="${s.id}.xhtml" media-type="application/xhtml+xml"/>`,
          )
          .join(
            "",
          )}</manifest><spine>${sections.map((s) => `<itemref idref="${s.id}"/>`).join("")}</spine></package>`,
      ),
      ...Object.fromEntries(
        sections.map((s) => [
          `OPS/${s.id}.xhtml`,
          strToU8(
            `<html><body><h1>${s.title}</h1>${Array.from({ length: 4 }, () => `<p>${s.text} <em>Texto preservado.</em></p>`).join("")}</body></html>`,
          ),
        ]),
      ),
    }),
  );
}

test("EPUB carrega o arquivo autorizado e imprime a página 10 mesmo com estimativa baixa", async ({
  page,
}) => {
  const bytes = epubFixture();
  await page.route("**/api/reader-pages", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ volumeId: "first-volume", epub: true });
    await route.fulfill({ json: { url: "/tests/book.epub" } });
  });
  await page.route("**/tests/book.epub", (route) =>
    route.fulfill({ contentType: "application/epub+zip", body: bytes }),
  );
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.goto("/tests/open-book.html?mode=epub");
  const image = page.locator('[data-book-sheet="right"] image');
  await expect(image).toHaveAttribute("href", /^data:image\/png;base64,/);
  await expect(image.locator("title")).toHaveText("Página 10 da prévia de A estrela do sul");
  const rendered = await page.evaluate(async (bytes) => {
    const { readEpub } = await import("/src/lib/epub.ts");
    const { renderEpubPageTen } = await import("/src/lib/epubPreview.ts");
    return renderEpubPageTen(await readEpub(new Blob([new Uint8Array(bytes)])), "A estrela do sul");
  }, Array.from(bytes));
  expect(rendered!.text).toContain("Capítulo 10");
  expect(rendered!.text).toContain("trecho verdadeiro da décima página");
  expect(rendered!.text).not.toContain("seção 9");
  expect(rendered!.text).not.toContain("seção 11");
  await expect(image).toHaveAttribute("href", rendered!.imageUrl);
  await page.screenshot({ path: "test-results/open-book-epub.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(image).toHaveAttribute("href", rendered!.imageUrl);
});

test("EPUB pagina um capítulo longo sem repetir a primeira página", async ({ page }) => {
  await page.goto("/tests/browser.html");
  const result = await page.evaluate(async () => {
    const { renderEpubPageTen } = await import("/src/lib/epubPreview.ts");
    const paragraphs = Array.from(
      { length: 200 },
      (_, i) =>
        `<p>Parágrafo ${i + 1}. O viajante olhou para a montanha e encontrou o castelo entre as árvores.</p>`,
    ).join("");
    return renderEpubPageTen(
      {
        kind: "text",
        estimatedPages: 1,
        sections: [{ title: "Único capítulo", html: `<h1>Início do livro</h1>${paragraphs}` }],
      },
      "Drácula",
    );
  });
  expect(result!.text).toContain("Parágrafo");
  expect(result!.text).not.toContain("Início do livro");
  expect(result!.text).not.toContain("Parágrafo 1.");
  expect(result!.text).not.toContain("Parágrafo 200.");
});

for (const failure of ["short", "denied", "download", "invalid"]) {
  test(`EPUB trata ${failure} sem texto fictício`, async ({ page }) => {
    await page.route("**/api/reader-pages", (route) =>
      route.fulfill(
        failure === "denied"
          ? { status: 403, json: { error: "Sem acesso" } }
          : { json: { url: "/tests/book.epub" } },
      ),
    );
    await page.route("**/tests/book.epub", (route) =>
      route.fulfill(
        failure === "download"
          ? { status: 500 }
          : {
              contentType: "application/epub+zip",
              body: failure === "invalid" ? Buffer.from("invalid archive") : epubFixture(1),
            },
      ),
    );
    await page.goto("/tests/open-book.html?mode=epub");
    await expect(page.locator('[data-book-sheet="right"] text')).toHaveText(
      failure === "short" ? "Página 10 indisponível" : "Prévia indisponível",
    );
    await expect(page.locator('[data-book-sheet="right"] image')).toHaveCount(0);
  });
}

test("EPUB de imagens mantém a décima imagem original", async ({ page }) => {
  await page.goto("/tests/browser.html");
  const result = await page.evaluate(async () => {
    const { renderEpubPageTen } = await import("/src/lib/epubPreview.ts");
    const sections = Array.from({ length: 12 }, (_, i) => ({
      title: `Imagem ${i + 1}`,
      html: `<img src="data:image/png;base64,page${i + 1}" />`,
    }));
    return {
      tenth: renderEpubPageTen({ kind: "images", estimatedPages: 12, sections }, "Livro"),
      short: renderEpubPageTen(
        { kind: "images", estimatedPages: 1, sections: sections.slice(0, 1) },
        "Livro",
      ),
    };
  });
  expect(result.tenth?.imageUrl).toBe("data:image/png;base64,page10");
  expect(result.short).toBeNull();
});
