import { expect, test, type Page } from "@playwright/test";

const frame = (page: Page) => page.frameLocator('iframe[title^="Página"]');
const savedPage = (page: Page) =>
  page.evaluate(() => localStorage.getItem("mangaka-page-reader-test"));
async function openReader(page: Page, mode = "paged", images = false) {
  await page.addInitScript(
    ({ mode }) => {
      localStorage.setItem("mangaka-reading-mode", mode);
      localStorage.setItem("mangaka-page-reader-test", "0");
    },
    { mode },
  );
  await page.goto(`/tests/reader.html${images ? "?images" : ""}`);
  await expect(frame(page).locator("#content, .epub-manga-page").first()).toBeVisible();
  await expect.poll(() => savedPage(page)).toBe("0");
}
async function hold(page: Page) {
  await page.mouse.move(180, 350);
  await page.mouse.down();
  await expect(page.getByRole("dialog", { name: "Navegar pelas páginas" })).toBeVisible();
  await page.mouse.up();
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("scroll recolhe o menu e não muda as dimensões da página ao abrir controles", async ({
  page,
}) => {
  await openReader(page);
  const reader = page.locator('iframe[title^="Página"]');
  const before = await reader.boundingBox();
  await page.getByRole("button", { name: "Scroll", exact: true }).click();
  await expect(page.getByRole("button", { name: "Scroll", exact: true })).toHaveCount(0);
  await page.mouse.click(180, 350);
  await expect(page.getByRole("button", { name: "Scroll", exact: true })).toBeVisible();
  expect(await reader.boundingBox()).toEqual(before);
  await page.mouse.move(180, 350);
  await page.mouse.wheel(0, 600);
  await expect(page.getByRole("button", { name: "Scroll", exact: true })).toHaveCount(0);
  await expect.poll(() => savedPage(page)).not.toBe("0");
});

for (const mode of ["paged", "vertical"]) {
  test(`toque longo abre prévia e só confirma o salto ao escolher ler (${mode})`, async ({
    page,
  }) => {
    await openReader(page, mode);
    await hold(page);
    await page.getByRole("spinbutton", { name: "Ir para página" }).fill("5");
    await expect(page.getByLabel("Prévia da página 5", { exact: true })).toBeVisible();
    expect(await savedPage(page)).toBe("0");
    await page.getByRole("button", { name: "Ler esta página" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => savedPage(page)).toBe("4");
    if (mode === "vertical") {
      const y = await frame(page)
        .locator("body")
        .evaluate(() => window.scrollY);
      expect(y).toBeGreaterThan(0);
    }
    await hold(page);
    await page.getByRole("slider", { name: "Selecionar página" }).fill("8");
    await page.getByRole("button", { name: "Fechar navegação de páginas" }).click();
    expect(await savedPage(page)).toBe("4");
  });
}

test("movimento e cancelamento não disparam toque longo nem reabrem o menu", async ({ page }) => {
  await openReader(page, "vertical");
  const body = frame(page).locator("body");
  await body.dispatchEvent("pointerdown", {
    pointerId: 1,
    isPrimary: true,
    pointerType: "touch",
    button: 0,
    clientX: 180,
    clientY: 350,
  });
  await body.dispatchEvent("pointermove", {
    pointerId: 1,
    isPrimary: true,
    pointerType: "touch",
    clientX: 180,
    clientY: 280,
  });
  await page.waitForTimeout(650);
  await body.dispatchEvent("pointerup", {
    pointerId: 1,
    isPrimary: true,
    pointerType: "touch",
    clientX: 180,
    clientY: 350,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scroll", exact: true })).toHaveCount(0);
  await body.dispatchEvent("pointerdown", { pointerId: 2, isPrimary: true, button: 0 });
  await body.dispatchEvent("pointercancel", { pointerId: 2 });
  await page.waitForTimeout(650);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("navegação tem alternativa por botão, limites e fechamento pelo teclado", async ({ page }) => {
  await openReader(page);
  await page.getByRole("button", { name: "Navegar pelas páginas" }).click();
  await expect(page.getByRole("button", { name: "Página anterior da prévia" })).toBeDisabled();
  await page.getByRole("spinbutton", { name: "Ir para página" }).fill("99999");
  await expect(page.getByRole("button", { name: "Ler esta página" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await savedPage(page)).toBe("0");
});

test("EPUB com imagens permite prévia e salto no modo scroll", async ({ page }) => {
  await openReader(page, "vertical", true);
  await hold(page);
  await page.getByRole("spinbutton", { name: "Ir para página" }).fill("7");
  await expect(
    page.frameLocator('iframe[title="Prévia de leitura"]').getByAltText("Página 7"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ler esta página" }).click();
  await expect.poll(() => savedPage(page)).toBe("6");
});

test("leitor e navegação cabem no desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openReader(page);
  await hold(page);
  const dialog = page.getByRole("dialog");
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
  await dialog.screenshot({ path: "test-results/reader-page-navigator.png" });
});

test("toque longo real no celular abre o painel sem acionar o toque curto", async ({
  page,
  context,
}) => {
  await openReader(page, "vertical");
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 180, y: 350 }],
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByRole("button", { name: "Fechar navegação de páginas" }).click();
  await expect(page.getByRole("button", { name: "Scroll", exact: true })).toHaveCount(0);
  expect(await savedPage(page)).toBe("0");
});

for (const mode of ["paged", "vertical"]) {
  test(`livro digitalizado tem toque longo e navegação (${mode})`, async ({ page }) => {
    await page.addInitScript((mode) => localStorage.setItem("mangaka-reading-mode", mode), mode);
    await page.goto("/tests/reader.html?scanned");
    await expect(page.getByAltText("Página 1", { exact: true })).toBeVisible();
    await hold(page);
    await page.getByRole("spinbutton", { name: "Ir para página" }).fill("4");
    await expect(page.getByAltText("Prévia da página selecionada")).toBeVisible();
    expect(await savedPage(page)).toBe("0");
    await page.getByRole("button", { name: "Ler esta página" }).click();
    await expect.poll(() => savedPage(page)).toBe("3");
    await expect(page.getByAltText("Página 4", { exact: true })).toBeInViewport();
  });
}

test("deslizar com o dedo continua virando páginas do EPUB", async ({ page, context }) => {
  await openReader(page);
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 280, y: 350 }],
  });
  for (const x of [240, 200, 160, 100]) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: 350 }],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => savedPage(page)).toBe("1");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("fonte recalcula a contagem pessoal e aparência é reutilizada em outro livro", async ({ page }) => {
  await openReader(page);
  const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem("booksyde:reader:guest:layouts") || "{}")["reader-test"]);
  await expect.poll(async () => (await layout())?.pageCount).toBeGreaterThan(1);
  const before = (await layout()).pageCount;
  await page.getByRole("button", { name: "Aparência da leitura" }).click();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Aumentar fonte" }).click();
  await page.getByRole("button", { name: "Fundo Sépia", exact: true }).click();
  await expect.poll(async () => (await layout())?.pageCount).toBeGreaterThan(before);
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("booksyde:reader:guest:preferences")!));
  expect(prefs).toMatchObject({ fontSize: 30, palette: "sepia" });
  await page.goto("/tests/reader.html?book=another-book");
  await expect(frame(page).locator("body")).toHaveCSS("font-size", "30px");
  await expect(frame(page).locator("body")).toHaveCSS("background-color", "rgb(242, 230, 210)");
  await page.reload();
  await expect(frame(page).locator("body")).toHaveCSS("font-size", "30px");
});
