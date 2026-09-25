import { expect, test } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";

// A valid multi-megabyte PDF with an xref table: PDF.js can locate pages without
// recovering a broken document by scanning/downloading every byte.
function pdfFixture(count = 80) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: count }, (_, i) => `${3 + i} 0 R`).join(" ")}] /Count ${count} >>`,
  ];
  for (let i = 0; i < count; i++) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Resources << >> /Contents ${3 + count + i} 0 R >>`);
  }
  for (let i = 0; i < count; i++) {
    const stream = `${i % 2} 0 0 rg 0 0 200 300 re f\n%${"padding".repeat(5000)}\n`;
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
  }
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((value, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${value}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

for (const provider of ["google-drive", "supabase"]) {
  test(`PDF ${provider} abre sem aguardar metadados e busca trechos sob demanda`, async ({ page }) => {
    const bytes = pdfFixture();
    const ranges: string[] = [];
    let authorizations = 0;
    let releaseMetadata!: () => void;
    const metadata = new Promise<void>(resolve => { releaseMetadata = resolve; });
    await page.route("**/rest/v1/volumes?*", async route => {
      await metadata;
      await route.fulfill({ json: { number: 1, mangas: { title: "PDF de teste", slug: "pdf" } } });
    });
    const url = provider === "google-drive" ? "/api/reader-pages?sig=test" : "/storage/v1/object/sign/test.pdf";
    await page.route("**/api/reader-pages", route => {
      authorizations++;
      return route.fulfill({ json: { url, provider } });
    });
    await page.route(`**${url}`, route => {
      const range = route.request().headers()["range"];
      if (range) ranges.push(range);
      const [, startText, endText] = range?.match(/bytes=(\d+)-(\d+)/) ?? [];
      const start = Number(startText || 0);
      const end = endText ? Math.min(Number(endText), bytes.length - 1) : bytes.length - 1;
      return route.fulfill({
        status: range ? 206 : 200,
        body: bytes.subarray(start, end + 1),
        headers: {
          "content-type": "application/pdf",
          "accept-ranges": "bytes",
          "content-length": String(end - start + 1),
          ...(range ? { "content-range": `bytes ${start}-${end}/${bytes.length}` } : {}),
        },
      });
    });
    try {
      await page.goto("/tests/reader.html?pdf");
      await expect(page.getByText(/Página 1 de 80/)).toBeVisible();
      await expect.poll(() => page.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(300);
      expect(ranges.length).toBeGreaterThan(0);
      const requestedBytes = ranges.reduce((sum, range) => {
        const [, start, end] = range.match(/bytes=(\d+)-(\d+)/)!;
        return sum + Number(end) - Number(start) + 1;
      }, 0);
      expect(requestedBytes).toBeLessThan(bytes.length / 2);
      await page.getByRole("button", { name: "Próxima", exact: true }).click();
      await expect(page.getByText(/Página 2 de 80/)).toBeVisible();
      // Toggling controls should not resize/render the canvas again.
      const renders = await page.locator("canvas").evaluate((canvas) => {
        const before = canvas.getAttribute("width");
        canvas.setAttribute("data-before-width", before || "");
        return before;
      });
      await page.locator("canvas").click();
      await expect(page.locator("canvas")).toHaveAttribute("width", renders!);
      const reopened = await page.evaluate(async () => {
        const { openReaderPdf } = await import("/src/lib/pdfReader.ts");
        const controller = new AbortController();
        try { return (await openReaderPdf("reader-test", controller.signal)).numPages; }
        finally { controller.abort(); }
      });
      expect(reopened).toBe(80);
      expect(authorizations).toBe(1);
    } finally { releaseMetadata(); }
  });
}

test("EPUB começa o download antes dos metadados e não baixa de novo ao focar a janela", async ({ page }) => {
  const bytes = zipSync({
    "META-INF/container.xml": strToU8('<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>'),
    "book.opf": strToU8('<package><manifest><item id="a" href="a.xhtml"/></manifest><spine><itemref idref="a"/></spine></package>'),
    "a.xhtml": strToU8('<html><body><h1>Livro rápido</h1><p>Conteúdo da leitura.</p></body></html>'),
  });
  let downloads = 0;
  let releaseMetadata!: () => void;
  const metadata = new Promise<void>(resolve => { releaseMetadata = resolve; });
  await page.route("**/rest/v1/volumes?*", async route => {
    await metadata;
    await route.fulfill({ json: { number: 1, unit_kind: "volume", mangas: { title: "Livro rápido", slug: "livro", work_type: "book" } } });
  });
  await page.route("**/rest/v1/rpc/booksyde_reader_source", route => route.fulfill({ json: "book.epub" }));
  await page.route("**/storage/v1/object/sign/volume-sources/book.epub", route => route.fulfill({ json: { signedURL: "/object/sign/volume-sources/book.epub?token=test" } }));
  await page.route("**/storage/v1/object/sign/volume-sources/book.epub?token=test", route => {
    downloads++;
    return route.fulfill({ body: Buffer.from(bytes), contentType: "application/epub+zip" });
  });
  try {
    await page.goto("/tests/reader.html?uncached");
    await expect.poll(() => downloads).toBe(1);
  } finally { releaseMetadata(); }
  await expect(page.frameLocator("iframe").locator("body")).toContainText("Conteúdo da leitura.");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.frameLocator("iframe").locator("body")).toContainText("Conteúdo da leitura.");
  expect(downloads).toBe(1);
});

test("EPUB grande descompacta no navegador mantendo todo o texto", async ({ page }) => {
  const chapter = `<html><body><h1>Capítulo grande</h1>${"<p>Uma viagem pela biblioteca e suas histórias.</p>".repeat(15000)}</body></html>`;
  const bytes = zipSync({
    "META-INF/container.xml": strToU8('<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>'),
    "book.opf": strToU8('<package><manifest><item id="a" href="a.xhtml"/></manifest><spine><itemref idref="a"/></spine></package>'),
    "a.xhtml": strToU8(chapter),
  });
  await page.goto("/tests/browser.html");
  const result = await page.evaluate(async bytes => {
    const { readEpub } = await import("/src/lib/epub.ts");
    const book = await readEpub(new Blob([new Uint8Array(bytes)]));
    const doc = new DOMParser().parseFromString(book.sections[0].html, "text/html");
    return { kind: book.kind, paragraphs: doc.querySelectorAll("p").length };
  }, Array.from(bytes));
  expect(result).toEqual({ kind: "text", paragraphs: 15000 });
});

test("PDF sem suporte a ranges continua abrindo pelo download completo", async ({ page }) => {
  await page.route("**/api/reader-pages", route => route.fulfill({ json: { url: "/whole.pdf" } }));
  await page.route("**/whole.pdf", route => route.fulfill({ body: pdfFixture(2), contentType: "application/pdf" }));
  await page.goto("/tests/browser.html");
  const pages = await page.evaluate(async () => {
    const { openReaderPdf } = await import("/src/lib/pdfReader.ts");
    const controller = new AbortController();
    try { return (await openReaderPdf("whole", controller.signal)).numPages; }
    finally { controller.abort(); }
  });
  expect(pages).toBe(2);
});

test("sair durante a autorização cancela a abertura do PDF", async ({ page }) => {
  await page.route("**/api/reader-pages", route => route.abort());
  await page.goto("/tests/browser.html");
  const error = await page.evaluate(async () => {
    const { openReaderPdf } = await import("/src/lib/pdfReader.ts");
    const controller = new AbortController();
    const loading = openReaderPdf("cancelled", controller.signal);
    controller.abort();
    try { await loading; return "not cancelled"; }
    catch (error) { return (error as Error).name; }
  });
  expect(error).toBe("AbortError");
});
