import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const epub = (broken = false) =>
  Array.from(
    zipSync({
      mimetype: strToU8("application/epub+zip"),
      "META-INF/container.xml": strToU8(
        '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
      ),
      "OPS/book.opf": strToU8(
        '<package><manifest><item id="a" href="a.xhtml"/><item id="z" href="z.xhtml"/></manifest><spine><itemref idref="z"/><itemref idref="a"/></spine></package>',
      ),
      "OPS/z.xhtml": strToU8(
        '<html><body><h1>Primeiro capítulo</h1><p>Texto sem imagens. Uma longa viagem pela biblioteca revelou relatos de aventuras, amizades e descobertas. Os leitores se reuniram para conhecer essas histórias e compartilhar suas próprias lembranças, enquanto a tarde avançava.</p><script>window.pwned=true</script><img src="https://evil.invalid/a.png" onerror="alert(1)"><a href="javascript:alert(1)">Link</a></body></html>',
      ),
      ...(broken
        ? {}
        : {
            "OPS/a.xhtml": strToU8(
              "<html><body><h1>Segundo capítulo</h1><p>Fim.</p></body></html>",
            ),
          }),
    }),
  );

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser.html");
});

test("formatos por obra, volume zero e numeração de lote são validados", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { validatePublicationFiles, validateVolumeCovers } = await import("/src/lib/publication.ts");
    const check = (type: "book" | "manga" | "hq" | "gibi", name: string, number: number) => {
      try {
        validatePublicationFiles(type, [new File(["conteúdo"], name)], number);
        return "ok";
      } catch (error) { return (error as Error).message; }
    };
    let badCover = "";
    try { validateVolumeCovers([new File(["x"], "script.svg", { type: "image/svg+xml" })]); }
    catch (error) { badCover = (error as Error).message; }
    return [
      check("book", "livro.pdf", 1),
      check("book", "livro.EPUB", 1),
      check("manga", "quadrinho.pdf", 0),
      check("hq", "volume.cbr", 0),
      check("gibi", "volume.cbz", 1),
      check("book", "comic.cbr", 1),
      check("manga", "a.pdf", 1.5),
      check("hq", "a.pdf", -1),
      check("hq", "a.pdf", Number.MAX_SAFE_INTEGER),
      badCover,
    ];
  });
  expect(result.slice(0, 5)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
  expect(result[5]).toContain("apenas EPUB ou PDF");
  expect(result[6]).toContain("número inteiro");
  expect(result[7]).toContain("número inteiro");
  expect(result[8]).toContain("número inteiro");
  expect(result[9]).toContain("Capa inválida");
});

test("ePub preserva texto e ordem do spine e remove conteúdo executável", async ({ page }) => {
  const sections = await page.evaluate(async (bytes) => {
    const { readEpub } = await import("/src/lib/epub.ts");
    return (await readEpub(new Blob([new Uint8Array(bytes)]))).sections;
  }, epub());
  expect(sections.map((section) => section.title)).toEqual([
    "Primeiro capítulo",
    "Segundo capítulo",
  ]);
  expect(sections[0].html).toContain("Texto sem imagens.");
  expect(sections[0].html).not.toMatch(/script|onerror|javascript:|evil.invalid/);
});

test("ePub incompleto falha antes da publicação", async ({ page }) => {
  const error = await page.evaluate(async (bytes) => {
    const { readEpub } = await import("/src/lib/epub.ts");
    try {
      await readEpub(new Blob([new Uint8Array(bytes)]));
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  }, epub(true));
  expect(error).toContain("seção ausente");
});

test("PDF é renderizado em páginas de imagem na ordem original", async ({ page }) => {
  const pdf =
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 25 >>\nstream\n1 0 0 rg 0 0 200 300 re f\nendstream\nendobj\n5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 6 0 R >>\nendobj\n6 0 obj\n<< /Length 25 >>\nstream\n0 0 1 rg 0 0 300 200 re f\nendstream\nendobj\ntrailer\n<< /Root 1 0 R /Size 7 >>\n%%EOF";
  const result = await page.evaluate(async (pdf) => {
    const { extractPages } = await import("/src/lib/mangaFile.ts");
    const pages = await extractPages(new File([pdf], "comic.pdf", { type: "application/pdf" }));
    return Promise.all(
      pages.map(async (page) => {
        const image = await createImageBitmap(new Blob([page.bytes], { type: page.type }));
        return { type: page.type, width: image.width, height: image.height };
      }),
    );
  }, pdf);
  expect(result).toEqual([
    { type: "image/png", width: 400, height: 600 },
    { type: "image/png", width: 600, height: 400 },
  ]);
});

test("home combina filtros de tipo, gênero e busca", async ({ page }) => {
  const works = [
    { id: "1", slug: "manga", title: "Aventura Mangá", work_type: "manga", genres: ["Aventura"] },
    { id: "2", slug: "hq", title: "Herói HQ", work_type: "hq", genres: ["Aventura"] },
    { id: "3", slug: "gibi", title: "Turma Gibi", work_type: "gibi", genres: ["Humor"] },
    { id: "4", slug: "livro", title: "Romance Livro", work_type: "book", genres: ["Romance"] },
  ].map((work) => ({
    ...work,
    author: "Autor",
    cover_url: null,
    currency: "BRL",
    price_cents: 0,
    view_count: 0,
  }));
  await page.route("**/rest/v1/**", (route) =>
    route.fulfill({ json: route.request().url().includes("/mangas?") ? works : [] }),
  );
  await page.goto("/tests/home.html");
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.getByRole("button", { name: "Livros", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Romance Livro" })).toBeVisible();
  await page.getByRole("button", { name: "HQs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Herói HQ" })).toBeVisible();
  await page.getByRole("button", { name: "Gibis", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Turma Gibi" })).toBeVisible();
  await page.getByRole("button", { name: "Mangás", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Aventura Mangá" })).toBeVisible();
  await page.getByRole("button", { name: "Todas", exact: true }).click();
  await page.getByRole("combobox", { name: "Filtrar por gênero" }).selectOption("Aventura");
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("searchbox").fill("heroi");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Herói HQ" })).toBeVisible();
});
