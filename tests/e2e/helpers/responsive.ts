import type { Page } from "@playwright/test";

/** Breakpoints audited by the responsive suite. */
export const BREAKPOINTS = [
  { name: "xs-480", width: 480, height: 900 },
  { name: "sm-640", width: 640, height: 900 },
  { name: "md-768", width: 768, height: 1000 },
  { name: "lg-1024", width: 1024, height: 900 },
  { name: "xl-1280", width: 1280, height: 900 },
] as const;

export type Breakpoint = (typeof BREAKPOINTS)[number];

export type OverflowReport = {
  scrollWidth: number;
  clientWidth: number;
  overflowPx: number;
  offenders: Array<{ index: number; selector: string; right: number; width: number }>;
};

/** Tolerance (px) for sub-pixel rounding / scrollbar artifacts. */
export const OVERFLOW_TOLERANCE = 2;

/**
 * Measures horizontal overflow of the document and lists the DOM nodes whose
 * box extends past the viewport, so failures point at the guilty element.
 */
export async function measureOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const clientWidth = doc.clientWidth;
    const scrollWidth = Math.max(doc.scrollWidth, document.body.scrollWidth);

    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    const offenders: Array<{ index: number; selector: string; right: number; width: number }> = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      el.removeAttribute("data-e2e-offender");
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (style.position === "fixed") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > clientWidth + 2 || rect.left < -2) {
        offenders.push({
          index: 0,
          selector: describe(el),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
        // Marca o nó para permitir screenshot/dump do elemento culpado.
        el.setAttribute("data-e2e-offender", String(offenders.length - 1));
        offenders[offenders.length - 1].index = offenders.length - 1;
      }
    }

    // Keep the widest offenders only — nested children repeat the same issue.
    offenders.sort((a, b) => b.right - a.right);

    return {
      scrollWidth: Math.round(scrollWidth),
      clientWidth,
      overflowPx: Math.max(0, Math.round(scrollWidth - clientWidth)),
      offenders: offenders.slice(0, 8),
    };
  });
}

/** Finds text nodes that are clipped or overlapping (basic layout-break check). */
export async function findLayoutBreaks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const seen = new Set<string>();
    const push = (msg: string) => {
      if (!seen.has(msg)) {
        seen.add(msg);
        issues.push(msg);
      }
    };

    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // Content wider than its own box with no scroll/ellipsis strategy.
      const overflowsSelf = el.scrollWidth - el.clientWidth > 2;
      const handled =
        style.overflowX === "auto" ||
        style.overflowX === "scroll" ||
        style.textOverflow === "ellipsis";
      if (overflowsSelf && !handled && el.children.length === 0) {
        push(
          `clipped content: ${el.tagName.toLowerCase()} (${el.scrollWidth}px in ${el.clientWidth}px)`,
        );
      }
    }
    return issues.slice(0, 10);
  });
}

/** Interactive controls must be reachable with a finger on touch screens. */
export async function findSmallTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const MIN = 36;
    const out: string[] = [];
    const nodes = document.body.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, textarea, [role='button'], [role='tab']",
    );
    for (const el of Array.from(nodes)) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < MIN || r.width < MIN) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.tagName)
          .trim()
          .slice(0, 30);
        out.push(
          `${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return out.slice(0, 10);
  });
}

/** Waits until the app has settled (network idle + fonts) before measuring. */
export async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(250);
}
