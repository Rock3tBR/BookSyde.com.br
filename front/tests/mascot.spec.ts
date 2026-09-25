import { expect, test } from "@playwright/test";

test("quadros movem asa, olhos e página sem transformar o cartão inteiro", async ({ page }) => {
  const remote: string[] = [];
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:4179/")) remote.push(request.url()); });
  await page.goto("/tests/mascot.html");
  const sprite = page.locator(".booksyde-mascot-sprite").first();
  await expect.poll(() => sprite.evaluate(el => el.getAnimations()[0]?.playState)).toBe("running");
  await sprite.evaluate(el => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 0; });
  const first = await sprite.screenshot({ path: "test-results/mascot-rest.png" });
  await sprite.evaluate(el => { el.getAnimations()[0].currentTime = 1800; });
  const turn = await sprite.screenshot({ path: "test-results/mascot-page-turn.png" });
  expect(Buffer.compare(first, turn)).not.toBe(0);
  expect(await sprite.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  await sprite.evaluate(el => { el.getAnimations()[0].currentTime = 3990; });
  await sprite.screenshot({ path: "test-results/mascot-loop-end.png" });
  await sprite.evaluate(el => { el.getAnimations()[0].currentTime = 4000; });
  expect(Buffer.compare(first, await sprite.screenshot())).toBe(0);
  const anchors = await page.evaluate(async () => {
    const image = new Image();
    image.src = "/brand/mascot/reading-frames-v3.webp";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const size = image.width / 8;
    return [0, 47].map(frame => {
      const pixels = ctx.getImageData(frame % 8 * size, Math.floor(frame / 8) * size, size, size).data;
      let left = size, right = 0, bottom = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (pixels[(y * size + x) * 4 + 3] > 32) {
          left = Math.min(left, x); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      }
      return { center: (left + right) / 2, bottom };
    });
  });
  expect(Math.abs(anchors[0].bottom - anchors[1].bottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(anchors[0].center - anchors[1].center)).toBeLessThanOrEqual(2);
  expect(remote).toEqual([]);
  await page.screenshot({ path: "test-results/mascot-preview.png" });
});

test("mudança de status preserva a sequência em andamento", async ({ page }) => {
  await page.goto("/tests/mascot.html");
  const sprite = page.locator(".booksyde-crow-stage .booksyde-mascot-sprite");
  await expect.poll(() => sprite.evaluate(el => Number(el.getAnimations()[0]?.currentTime))).toBeGreaterThan(500);
  const previous = await sprite.evaluate(el => Number(el.getAnimations()[0].currentTime));
  await page.getByRole("button", { name: "Concluir download" }).click();
  await expect(page.getByText("Pronto para ler!")).toBeVisible();
  expect(await sprite.evaluate(el => Number(el.getAnimations()[0].currentTime))).toBeGreaterThanOrEqual(previous);
});

test("reduzir movimento conserva o mascote legível sem animação", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/mascot.html");
  const sprite = page.locator(".booksyde-mascot-sprite").first();
  await expect(sprite).toBeVisible();
  expect(await sprite.evaluate(el => el.getAnimations().length)).toBe(0);
  expect(await sprite.evaluate(el => getComputedStyle(el).backgroundPosition)).toBe("0% 0%");
});

test("animação pausa fora da tela e quando a aba fica oculta", async ({ page }) => {
  await page.goto("/tests/mascot.html");
  const sprite = page.locator(".booksyde-mascot-sprite").first();
  await expect(sprite).toHaveCSS("animation-play-state", "running");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(sprite).toHaveCSS("animation-play-state", "paused");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(sprite).toHaveCSS("animation-play-state", "running");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(sprite).toHaveCSS("animation-play-state", "paused");
});

test("prévia cabe no celular e permite pausar manualmente", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/mascot.html");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.locator(".booksyde-mascot-sprite").first()).toHaveCSS("animation-play-state", "paused");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
