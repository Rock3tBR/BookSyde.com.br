import { expect, test } from "@playwright/test";

const works = Array.from({ length: 4 }, (_, i) => ({
  id: `work-${i}`,
  slug: `obra-${i}`,
  title: `Uma aventura muito longa ${i}`,
  author: "Autor",
  genres: ["Aventura"],
  work_type: "manga",
  cover_url: null,
  price_cents: 0,
  currency: "BRL",
  view_count: 0,
  created_at: new Date().toISOString(),
}));

test.beforeEach(async ({ page }) => {
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
          email: "leitor@example.com",
          aud: "authenticated",
          user_metadata: {},
        },
      }),
    );
  });
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop();
    let json: unknown = [];
    if (table === "mangas") json = works;
    if (table === "volumes")
      json = works.map((work, i) => ({
        id: `volume-${i}`,
        manga_id: work.id,
        number: 1,
        unit_kind: "volume",
        file_format: "pdf",
        page_count: 100,
      }));
    if (table === "reading_progress")
      json = works.map((_, i) => ({ volume_id: `volume-${i}`, page_index: 5, completed_at: null }));
    if (table === "profiles")
      json = {
        id: "reader",
        display_name: "Leitor com nome muito longo para testar o celular",
        user_code: "ABC12345",
        site_onboarding_completed: true,
        visible_work_types: ["manga", "hq", "book", "gibi"],
      };
    if (table === "user_roles") json = null;
    await route.fulfill({ json });
  });
});

for (const width of [320, 390, 768, 1440]) {
  test(`layout autenticado em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/tests/responsive.html");
    await expect(page.getByRole("heading", { name: "Continue lendo" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Uma aventura muito longa 0.*pág/ })).toBeVisible();
    const assertWidth = async () => {
      const overflow = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        width: document.documentElement.scrollWidth,
        main: document.querySelector("main")!.getBoundingClientRect().width,
      }));
      expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1);
      expect(overflow.main).toBeLessThanOrEqual(overflow.viewport + 1);
    };
    await assertWidth();
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    await assertWidth();
    if (width < 1280) {
      await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
      await page.getByRole("link", { name: "Minha conta", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Abrir menu da conta" }).click();
      await page.getByRole("menuitem", { name: "Minha conta" }).click();
    }
    await expect(page.getByRole("tab", { name: "Perfil", exact: true })).toBeVisible();
    for (const tab of ["Perfil", "Leitura", "Catálogo", "Segurança"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await assertWidth();
    }
    await page.getByRole("button", { name: "Abrir amigos e conversas" }).click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(width + 1);
    await page.getByRole("link", { name: "Abrir conversas", exact: true }).click();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await assertWidth();
  });
}

for (const asFolder of [true, false]) {
  test(`biblioteca cria pasta e importa ${asFolder ? "pasta" : "conteúdo"} no celular`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const folders: { id: string; name: string; color: string; creator_id: string }[] = [];
    const items: { id: string; folder_id: string | null; manga: (typeof works)[number] }[] = [];
    const codes: { code: string; folder_id: string; expires_at: string; used_at: null }[] = [];
    let redeemed = false;
    await page.route("**/rest/v1/rpc/**", async (route) => {
      const rpc = route.request().url().split("/").pop();
      const args = route.request().postDataJSON();
      if (rpc === "get_library_workspace")
        return route.fulfill({ json: { folders, items, codes } });
      if (rpc === "save_library_folder") {
        expect(args._name).toBe("Meus estudos");
        expect(args._color).toBe("#7354d1");
        expect(args._manga_ids).toHaveLength(3);
        folders.push({ id: "folder", name: args._name, color: args._color, creator_id: "reader" });
        for (const id of args._manga_ids)
          items.push({ id, folder_id: "folder", manga: works.find((m) => m.id === id)! });
        return route.fulfill({ json: "folder" });
      }
      if (rpc === "generate_library_share") {
        expect(args._folder_id).toBe("folder");
        codes.push({
          code: "generated-code",
          folder_id: "folder",
          expires_at: new Date(Date.now() + 43200000).toISOString(),
          used_at: null,
        });
        return route.fulfill({ json: codes[0] });
      }
      if (rpc === "redeem_library_share") {
        expect(args._as_folder).toBe(asFolder);
        expect(args._folder_name).toBe(asFolder ? "Minha coleção" : null);
        expect(args._folder_color).toBe(asFolder ? "#32a875" : null);
        if (args._code === "expired")
          return route.fulfill({
            status: 400,
            json: { message: "Código inválido, expirado ou já utilizado." },
          });
        expect(args._code).toBe("valid-code");
        redeemed = true;
        if (asFolder)
          folders.push({
            id: "imported",
            name: args._folder_name,
            color: args._folder_color,
            creator_id: "someone-else",
          });
        items.push({
          id: "received",
          folder_id: asFolder ? "imported" : null,
          manga: { ...works[0]!, id: "received", title: "Livro recebido", slug: "received" },
        });
        return route.fulfill({ json: { count: 1 } });
      }
      return route.fulfill({ status: 400, json: { message: "Unexpected RPC" } });
    });
    await page.goto("/tests/responsive.html");
    await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Biblioteca", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nova pasta", exact: true }).click();
    await page.getByLabel("Nome da pasta").fill("Meus estudos");
    await page.getByLabel("Cor da pasta").fill("#7354d1");
    for (let i = 0; i < 3; i++) await page.getByRole("checkbox").nth(i).check();
    await page.getByRole("button", { name: "Salvar pasta", exact: true }).click();
    const folderCard = page.getByRole("button", { name: /Meus estudos.*3 itens/ });
    await expect(folderCard.locator(".library-folder-item-title")).toHaveText(works[0]!.title);
    await folderCard.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await folderCard.screenshot({ path: "/tmp/mangaka-folder-card.png" });
    await folderCard.click();
    await page.getByRole("button", { name: "Editar pasta", exact: true }).click();
    await expect(page.getByLabel("Nome da pasta")).toHaveValue("Meus estudos");
    await expect(page.getByLabel("Cor da pasta")).toHaveValue("#7354d1");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Compartilhar pasta", exact: true }).click();
    await page.getByRole("button", { name: "Gerar código de compartilhamento" }).click();
    await expect(page.getByText("generated-code", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
    await page.getByRole("button", { name: "Importar para biblioteca", exact: true }).click();
    await expect(page.getByLabel("Nome da pasta")).toBeVisible();
    if (!asFolder) {
      await page.getByRole("radio", { name: /Adicionar somente o conteúdo/ }).check();
      await expect(page.getByLabel("Nome da pasta")).toHaveCount(0);
      await expect(page.getByLabel("Cor da pasta")).toHaveCount(0);
    } else {
      await page.getByLabel("Nome da pasta").fill("Minha coleção");
      await page.getByLabel("Cor da pasta").fill("#32a875");
    }
    await page.getByLabel("Código de compartilhamento").fill("expired");
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Código inválido, expirado ou já utilizado.");
    await page.getByLabel("Código de compartilhamento").fill("valid-code");
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(redeemed).toBe(true);
    if (asFolder) {
      await page.getByRole("button", { name: /Minha coleção/ }).click();
      await expect(
        page.getByRole("button", { name: "Compartilhar pasta", exact: true }),
      ).toHaveCount(0);
    }
    await expect(page.getByRole("heading", { name: "Livro recebido", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
}
