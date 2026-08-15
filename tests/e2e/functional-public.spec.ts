import { expect, test, type Page } from "@playwright/test";
import { settle } from "./helpers/responsive";
import { snap } from "./helpers/artifacts";

/** Coleta erros de console/página para falhar em runtime errors reais. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

const IGNORABLE = [
  /favicon/i,
  /Failed to load resource/i,
  /ResizeObserver/i,
  /Download the React DevTools/i,
  /net::ERR_/i,
];

function realErrors(errors: string[]) {
  return errors.filter((e) => !IGNORABLE.some((re) => re.test(e)));
}

test.describe("Funcional — rotas públicas", () => {
  test("landing carrega com hero, título e CTAs de acesso", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await settle(page);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.title()).toContain("Lecto");

    const loginLinks = page.getByRole("link", { name: /entrar|acessar|login|começar/i });
    expect(await loginLinks.count()).toBeGreaterThan(0);

    await snap(page, testInfo, "landing");
    expect(realErrors(errors), realErrors(errors).join("\n")).toEqual([]);
  });

  test("navega da landing para o login institucional", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page
      .getByRole("link", { name: /entrar|acessar|login/i })
      .first()
      .click();
    await page.waitForURL(/\/auth/);
    await expect(page.getByLabel(/e-?mail/i).first()).toBeVisible();
  });

  test("login staff exibe erro com credenciais inválidas", async ({ page }, testInfo) => {
    await page.goto("/auth");
    await settle(page);

    await page
      .getByLabel(/e-?mail/i)
      .first()
      .fill("nao-existe@example.com");
    await page.getByLabel(/senha/i).first().fill("senha-invalida-123");
    await page
      .getByRole("button", { name: /entrar/i })
      .first()
      .click();

    await expect(page.locator("[data-sonner-toast], [role='status']").first()).toBeVisible({
      timeout: 15_000,
    });
    await snap(page, testInfo, "login-erro");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("login do aluno valida código de turma inexistente", async ({ page }) => {
    await page.goto("/auth/student");
    await settle(page);

    await page.locator("#classCode").fill("ZZZZZZ");
    await page.locator("#studentCode").fill("0000");
    await page.locator("#pin").fill("1234");

    await page
      .getByRole("button", { name: /entrar|acessar/i })
      .first()
      .click();

    await expect(page.locator("[data-sonner-toast], [role='status']").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/auth\/student/);
  });

  test("rota protegida /app redireciona para o login quando deslogado", async ({ page }) => {
    await page.goto("/app");
    await page.waitForURL(/\/auth/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth/);
  });

  test("rota inexistente não quebra a aplicação", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/rota-que-nao-existe-123");
    await settle(page);
    await expect(page.locator("body")).toBeVisible();
    expect(realErrors(errors).length).toBeLessThanOrEqual(1);
  });
});
