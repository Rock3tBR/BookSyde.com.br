import { expect, test } from "@playwright/test";

for (const [width, height] of [
  [320, 568],
  [390, 664],
  [768, 800],
  [1366, 653],
  [1440, 768],
  [1672, 941],
]) {
  test(`login e cadastro cabem em ${width}x${height} sem rolagem`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/tests/auth.html");
    await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
    await expect(page.locator(".auth-art > img")).toHaveJSProperty("naturalWidth", 1024);
    await page.evaluate(() => document.fonts.ready);
    const assertFits = async () => {
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        cardBottom: document.querySelector(".auth-card")!.getBoundingClientRect().bottom,
      }));
      expect(dimensions.width).toBeLessThanOrEqual(width);
      expect(dimensions.height).toBeLessThanOrEqual(height);
      expect(dimensions.cardBottom).toBeLessThanOrEqual(height);
      await expect(page.getByRole("link", { name: "Política de Privacidade." })).toBeInViewport({
        ratio: 1,
      });
    };
    await assertFits();
    if (width === 1366)
      await page.screenshot({ path: "/tmp/booksyde-auth-compact.png", fullPage: true });
    await page.getByLabel("Senha", { exact: true }).fill("segredo123");
    await page.getByRole("button", { name: "Mostrar senha", exact: true }).click();
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("tab", { name: "Criar conta", exact: true }).click();
    await expect(page.getByLabel("Como quer ser chamado?")).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "password");
    await assertFits();
    await page.getByRole("tab", { name: "Entrar", exact: true }).click();
    await page.getByRole("button", { name: "Esqueceu sua senha?" }).click();
    await assertFits();
  });
}

test("envia credenciais, lembra apenas o e-mail e permite tentar novamente após erro", async ({
  page,
}) => {
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({ status: 400, json: { msg: "E-mail ou senha inválidos" } }),
  );
  await page.goto("/tests/auth.html");
  await page.getByLabel("E-mail", { exact: true }).fill("leitor@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-teste");
  await page.getByLabel("Lembrar e-mail").check();
  const request = page.waitForRequest("**/auth/v1/token**");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({
    email: "leitor@example.com",
    password: "senha-teste",
  });
  await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("senha-teste");
  await page.reload();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue("leitor@example.com");
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
});

test("recuperação envia e-mail com retorno ao formulário de senha", async ({ page }) => {
  await page.route("**/auth/v1/recover**", (route) => route.fulfill({ json: {} }));
  await page.goto("/tests/auth.html");
  await page.getByRole("button", { name: "Esqueceu sua senha?" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("leitor@example.com");
  const request = page.waitForRequest("**/auth/v1/recover**");
  await page.getByRole("button", { name: "Enviar link de recuperação" }).click();
  const recoveryRequest = await request;
  expect(recoveryRequest.postDataJSON().email).toBe("leitor@example.com");
  expect(new URL(recoveryRequest.url()).searchParams.get("redirect_to")).toBe(
    "http://127.0.0.1:4179/auth",
  );
  await expect(page.getByText(/Se houver uma conta/)).toBeVisible();
  await page.getByRole("button", { name: "Voltar para entrar" }).click();
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
});

test("cadastro envia nome e credenciais", async ({ page }) => {
  await page.route("**/auth/v1/signup**", (route) =>
    route.fulfill({
      json: { user: { id: "test-user", email: "leitor@example.com" }, session: null },
    }),
  );
  await page.goto("/tests/auth.html");
  await page.getByRole("tab", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Como quer ser chamado?").fill("Leitor");
  await page.getByLabel("E-mail", { exact: true }).fill("leitor@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-teste");
  const request = page.waitForRequest("**/auth/v1/signup**");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  const signupRequest = await request;
  expect(signupRequest.postDataJSON()).toMatchObject({
    email: "leitor@example.com",
    password: "senha-teste",
    data: { display_name: "Leitor" },
  });
  expect(new URL(signupRequest.url()).searchParams.get("redirect_to")).toBe(
    "http://127.0.0.1:4179/auth",
  );
  await expect(page.getByText("Conta criada! Confirme seu e-mail para entrar.")).toBeVisible();
});

test("Google usa o mesmo projeto Supabase e retorna para /auth", async ({ page }) => {
  await page.route("**/auth/v1/authorize**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Autorização Google" }),
  );
  await page.goto("/tests/auth.html");
  const request = page.waitForRequest("**/auth/v1/authorize**");
  await page.getByRole("button", { name: "Continuar com o Google" }).click();
  const url = new URL((await request).url());
  expect(url.origin).toBe("https://test.supabase.invalid");
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe("http://127.0.0.1:4179/auth");
  expect(url.pathname).toBe("/auth/v1/authorize");
});

test("link expirado oferece reenvio e limpa o erro da URL", async ({ page }) => {
  await page.route("**/auth/v1/resend**", (route) => route.fulfill({ json: {} }));
  await page.goto(
    "/tests/auth.html#error=access_denied&error_code=otp_expired&error_description=Email+link+expired",
  );
  await expect(page.getByRole("alert")).toContainText("expirou ou já foi usado");
  expect(new URL(page.url()).hash).toBe("");
  await page.getByLabel("E-mail", { exact: true }).fill("leitor@example.com");
  const request = page.waitForRequest("**/auth/v1/resend**");
  await page.getByRole("button", { name: "Reenviar confirmação" }).click();
  const resend = await request;
  expect(resend.postDataJSON()).toMatchObject({ type: "signup", email: "leitor@example.com" });
  expect(new URL(resend.url()).searchParams.get("redirect_to")).toBe("http://127.0.0.1:4179/auth");
  await expect(
    page.getByText("Se a conta estiver aguardando confirmação, você receberá um novo e-mail."),
  ).toBeVisible();
});

test("Google cancelado mostra erro e mantém o login disponível", async ({ page }) => {
  await page.goto("/tests/auth.html#error=access_denied&error_description=Access+denied");
  await expect(page.getByRole("alert")).toContainText("Não foi possível concluir o acesso");
  await expect(page.getByRole("button", { name: "Continuar com o Google" })).toBeEnabled();
});

test("retorno de confirmação restaura a sessão e remove tokens da URL", async ({ page }) => {
  const user = {
    id: "30000000-0000-4000-8000-000000000020",
    email: "leitor@example.com",
    aud: "authenticated",
    role: "authenticated",
  };
  await page.route("**/auth/v1/user", (route) => route.fulfill({ json: user }));
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test`;
  await page.goto(
    `/tests/auth.html#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.values(localStorage).some((value) => value.includes('"email":"leitor@example.com"')),
      ),
    )
    .toBe(true);
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
