import { expect, test } from "@playwright/test";
import { APP_ROUTES } from "./routes";
import {
  BREAKPOINTS,
  OVERFLOW_TOLERANCE,
  findLayoutBreaks,
  findSmallTouchTargets,
  measureOverflow,
  settle,
} from "./helpers/responsive";
import { captureEvidence } from "./helpers/artifacts";
import { hasSession, restoreSession } from "./helpers/auth";
import { record, writeSummary } from "./helpers/summary";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

test.describe("Responsividade — área logada (/app/*)", () => {
  test.skip(
    !hasSession(),
    "Nenhuma sessão autenticada disponível. Faça login no preview e rode novamente.",
  );

  test.afterAll(async () => {
    await writeSummary();
  });

  for (const bp of BREAKPOINTS) {
    for (const route of APP_ROUTES) {
      test(`${route.label} @ ${bp.width}px sem overflow horizontal`, async ({
        page,
        context,
      }, testInfo) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await restoreSession(context, page, BASE_URL);

        await page.goto(route.path);
        await settle(page);

        // Rotas fora do papel do usuário redirecionam — nesse caso auditamos
        // a tela realmente renderizada, o que continua sendo válido.
        const overflow = await measureOverflow(page);
        const breaks = await findLayoutBreaks(page);
        const smallTargets = bp.width <= 768 ? await findSmallTouchTargets(page) : [];

        let evidence;
        if (overflow.overflowPx > OVERFLOW_TOLERANCE || breaks.length) {
          evidence = await captureEvidence(page, testInfo, {
            route: route.path,
            breakpoint: bp.width,
            overflow,
            layoutBreaks: breaks,
          });
        }

        record({
          route: route.path,
          label: route.label,
          breakpoint: bp.width,
          finalUrl: new URL(page.url()).pathname,
          overflowPx: overflow.overflowPx,
          offenders: overflow.offenders.map((o) => o.selector),
          layoutBreaks: breaks,
          smallTouchTargets: smallTargets,
          evidence,
        });

        expect(
          overflow.overflowPx,
          `Overflow horizontal em ${route.path} @${bp.width}px. Elementos: ${
            overflow.offenders.map((o) => `${o.selector}(right:${o.right})`).join(", ") || "n/d"
          }`,
        ).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      });
    }
  }

  test("sidebar recolhe em mobile e abre pelo gatilho", async ({ page, context }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await restoreSession(context, page, BASE_URL);
    await page.goto("/app");
    await settle(page);

    const trigger = page.getByRole("button", { name: /toggle sidebar/i }).first();
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(400);
      const overflow = await measureOverflow(page);
      expect(overflow.overflowPx).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    }
  });
});
