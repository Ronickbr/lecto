import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES } from "./routes";
import {
  BREAKPOINTS,
  OVERFLOW_TOLERANCE,
  findLayoutBreaks,
  findSmallTouchTargets,
  measureOverflow,
  settle,
} from "./helpers/responsive";
import { captureEvidence } from "./helpers/artifacts";
import { record, writeSummary } from "./helpers/summary";

test.describe("Responsividade — rotas públicas", () => {
  test.afterAll(async () => {
    await writeSummary();
  });

  for (const bp of BREAKPOINTS) {
    for (const route of PUBLIC_ROUTES) {
      test(`${route.label} @ ${bp.width}px sem overflow horizontal`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto(route.path);
        await settle(page);

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
});
