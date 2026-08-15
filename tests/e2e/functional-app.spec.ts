import { expect, test, type Page } from "@playwright/test";
import { APP_ROUTES } from "./routes";
import { settle } from "./helpers/responsive";
import { hasSession, restoreSession } from "./helpers/auth";
import { snap } from "./helpers/artifacts";
import { gotoStable, isHmrNoise } from "./helpers/nav";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

// Reexecuta automaticamente falhas causadas por timing de HMR do dev-server.
test.describe.configure({ retries: 2 });

const IGNORABLE = [
  /favicon/i,
  /Failed to load resource/i,
  /ResizeObserver/i,
  /Download the React DevTools/i,
  /net::ERR_/i,
  /401|403|PGRST/i,
];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !IGNORABLE.some((re) => re.test(text)) && !isHmrNoise(text)) {
      errors.push(text);
    }
  });
  page.on("pageerror", (err) => {
    if (!isHmrNoise(String(err))) errors.push(String(err));
  });
  return errors;
}

/** Uma página é considerada "quebrada" se mostra o error boundary. */
async function assertNoCrash(page: Page) {
  const crash = page.getByText(
    /algo deu errado|something went wrong|unexpected error|application error/i,
  );
  expect(await crash.count(), "Error boundary visível").toBe(0);
}

test.describe("Funcional — área logada (/app/*)", () => {
  test.skip(
    !hasSession(),
    "Nenhuma sessão autenticada disponível. Faça login no preview e rode novamente.",
  );

  for (const route of APP_ROUTES) {
    test(`${route.label} renderiza sem erro de runtime`, async ({ page, context }, testInfo) => {
      const errors = collectErrors(page);
      await restoreSession(context, page, BASE_URL);
      await gotoStable(page, route.path);

      // Rotas fora do papel do usuário podem redirecionar — isso é esperado.
      const finalPath = new URL(page.url()).pathname;
      expect(finalPath.startsWith("/app") || finalPath.startsWith("/auth")).toBeTruthy();

      await assertNoCrash(page);
      await expect(page.locator("main, body").first()).toBeVisible();

      if (errors.length) await snap(page, testInfo, `erros-${route.label}`);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("sidebar navega entre as seções disponíveis", async ({ page, context }, testInfo) => {
    await restoreSession(context, page, BASE_URL);
    await gotoStable(page, "/app");

    const links = page.locator("a[href^='/app']");
    const total = Math.min(await links.count(), 6);
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute("href");
      if (!href) continue;
      await link.click().catch(() => undefined);
      await settle(page);
      await assertNoCrash(page);
    }
    await snap(page, testInfo, "navegacao-sidebar");
  });

  test("diálogos de criação abrem e fecham", async ({ page, context }) => {
    await restoreSession(context, page, BASE_URL);
    for (const path of ["/app/school/classes", "/app/school/students", "/app/school/simulados"]) {
      await gotoStable(page, path);
      if (!new URL(page.url()).pathname.startsWith(path)) continue;

      const trigger = page.getByRole("button", { name: /nov[ao]|adicionar|criar/i }).first();
      if (!(await trigger.count())) continue;

      await trigger.click();
      const dialog = page.getByRole("dialog").first();
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    }
  });

  test("filtros do banco de textos respondem", async ({ page, context }) => {
    await restoreSession(context, page, BASE_URL);
    await gotoStable(page, "/app/school/texts");
    if (!new URL(page.url()).pathname.startsWith("/app/school/texts")) test.skip();

    const search = page
      .locator("input[type='search'], input[placeholder*='usc' i], input[placeholder*='iltr' i]")
      .first();
    if (await search.count()) {
      await search.fill("zzzz-nao-existe");
      await page.waitForTimeout(600);
      await assertNoCrash(page);
      await search.fill("");
      await page.waitForTimeout(400);
    }
    await assertNoCrash(page);
  });

  test("painéis com gráficos carregam sem travar", async ({ page, context }, testInfo) => {
    await restoreSession(context, page, BASE_URL);
    for (const path of ["/app/student/progresso", "/app/teacher/resultados"]) {
      await gotoStable(page, path);
      if (!new URL(page.url()).pathname.startsWith(path)) continue;
      await page.waitForTimeout(1200); // charts são lazy-loaded
      await assertNoCrash(page);
      await snap(page, testInfo, `graficos-${path}`);
    }
  });
});
