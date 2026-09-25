import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const pdf =
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 25 >>\nstream\n1 0 0 rg 0 0 200 300 re f\nendstream\nendobj\ntrailer\n<< /Root 1 0 R /Size 5 >>\n%%EOF";
const makeZip = (omitUnit = false) =>
  Buffer.from(
    zipSync({
      ...Object.fromEntries(
        Object.entries({
          "nome.txt": "Minha HQ",
          "descricao.txt": "Descrição",
          "categorias.txt": "Aventura",
          "sinopse.txt": "Uma história",
          "escritor.txt": "Autora",
          "preco.txt": "0",
          ...(omitUnit ? {} : { "unidade.txt": "capitulo" }),
        }).map(([name, value]) => [`Obra/${name}`, strToU8(value)]),
      ),
      ...Object.fromEntries([10, 5, 3, 4].map((n) => [`Obra/${n}.pdf`, strToU8(pdf)])),
    }),
  );

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "sb-test-auth-token",
      JSON.stringify({
        access_token: "test-token",
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: "creator",
          email: "creator@example.com",
          aud: "authenticated",
          user_metadata: {},
        },
      }),
    ),
  );
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    let json: unknown = [];
    if (url.pathname.endsWith("/user_roles"))
      json = url.searchParams.get("role") === "eq.creator" ? { role: "creator" } : null;
    await route.fulfill({ json });
  });
  await page.route("**/api/marketplace/**", (route) =>
    route.fulfill({ json: { connected: false } }),
  );
  await page.goto("/tests/publication-batch.html");
  await page.getByRole("button", { name: /Múltiplos/ }).click();
  await page.getByRole("button", { name: "HQs", exact: true }).click();
});

for (const width of [390, 1280]) {
  test(`revisão real do ZIP PDF permite ordem manual em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByLabel("Arquivo ZIP de obras")
      .setInputFiles({ name: "obras.zip", mimeType: "application/zip", buffer: makeZip() });
    const review = page.getByRole("region", { name: "Revisar Minha HQ" });
    await expect(review).toBeVisible({ timeout: 15000 });
    await expect(review.getByRole("listitem")).toHaveText([/3.pdf/, /4.pdf/, /5.pdf/, /10.pdf/]);
    await expect(review.getByAltText("Capa da obra")).toBeVisible();
    await expect(review.getByRole("spinbutton")).toHaveCount(4);
    expect(
      await review
        .getByRole("spinbutton")
        .evaluateAll((inputs) => inputs.map((el) => (el as HTMLInputElement).value)),
    ).toEqual(["3", "4", "5", "10"]);
    await review.getByRole("button", { name: "Mover 10 para cima" }).click();
    await expect(review.getByRole("listitem")).toHaveText([/3.pdf/, /4.pdf/, /10.pdf/, /5.pdf/]);
    await review.getByRole("button", { name: "Numerar em sequência" }).click();
    expect(
      await review
        .getByRole("spinbutton")
        .evaluateAll((inputs) => inputs.map((el) => (el as HTMLInputElement).value)),
    ).toEqual(["1", "2", "3", "4"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await review.screenshot({ path: `test-results/publication-batch-${width}.png` });
  });
}

test("unidade.txt ausente impede criação e informa como corrigir", async ({ page }) => {
  await page
    .getByLabel("Arquivo ZIP de obras")
    .setInputFiles({ name: "obras.zip", mimeType: "application/zip", buffer: makeZip(true) });
  await expect(page.getByText(/unidade.txt é obrigatório/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Criar .*obra\(s\)/ })).toBeDisabled();
});

test("publicação envia os números revisados e chapter até o banco", async ({ page }) => {
  const volumes: Array<{ number: number; unit_kind: string }> = [];
  let created: Record<string, unknown> | null = null;
  await page.route("**/storage/v1/object/**", (route) => route.fulfill({ json: { Key: "test" } }));
  await page.route("**/rest/v1/mangas?**", async (route) => {
    if (route.request().method() === "POST") {
      created = route.request().postDataJSON();
      return route.fulfill({ json: { id: "created-work" } });
    }
    const url = new URL(route.request().url());
    return route.fulfill({
      json: url.searchParams.has("id")
        ? { work_type: "hq", is_collection: false, cover_url: "storage:cover.jpg" }
        : [],
    });
  });
  await page.route("**/rest/v1/volumes?**", async (route) => {
    if (route.request().method() === "POST") {
      volumes.push(route.request().postDataJSON());
      return route.fulfill({ json: { id: `volume-${volumes.length}` } });
    }
    return route.fulfill({ json: route.request().method() === "PATCH" ? { id: "volume" } : [] });
  });
  await page
    .getByLabel("Arquivo ZIP de obras")
    .setInputFiles({ name: "obras.zip", mimeType: "application/zip", buffer: makeZip() });
  await expect(page.getByRole("region", { name: "Revisar Minha HQ" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Mover 10 para cima" }).click();
  await page.getByRole("button", { name: "Sou autor(a)", exact: true }).click();
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar 1 obra(s)", exact: true }).click();
  await expect.poll(() => volumes.length, { timeout: 15000 }).toBe(4);
  expect(volumes.map((volume) => [volume.number, volume.unit_kind])).toEqual([
    [3, "chapter"],
    [4, "chapter"],
    [5, "chapter"],
    [10, "chapter"],
  ]);
  expect(created).toMatchObject({
    work_type: "hq",
    title: "Minha HQ",
    creator_id: "creator",
    distribution_channel: "marketplace",
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          async () =>
            (await import("/src/lib/volumeUploadStatus.ts")).getVolumeUploadStatus().state,
        ),
      { timeout: 15000 },
    )
    .toBe("completed");
});
