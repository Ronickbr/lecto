import type { Page } from "@playwright/test";
import { settle } from "./responsive";

/**
 * Erros transitórios do dev-server (Vite/HMR) que não representam bug de app:
 * durante um reload de HMR os chunks antigos deixam de existir e o browser
 * reporta falha de import dinâmico até o próximo carregamento.
 */
export const HMR_NOISE = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /\[vite\]/i,
  /hmr/i,
  /Unable to preload CSS/i,
  /dynamically imported module/i,
];

export function isHmrNoise(text: string) {
  return HMR_NOISE.some((re) => re.test(text));
}

/**
 * Navega até `path` de forma estável mesmo se um reload de HMR acontecer no
 * meio: repete a navegação quando o carregamento falha por chunk obsoleto ou
 * quando a árvore React ainda não montou.
 */
export async function gotoStable(page: Page, path: string, attempts = 3) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await settle(page);
      const mounted = await page
        .waitForFunction(
          () => {
            const root = document.querySelector("#root, body");
            return !!root && root.textContent!.trim().length > 0;
          },
          undefined,
          { timeout: 15_000 },
        )
        .then(() => true)
        .catch(() => false);
      if (mounted) return;
      lastError = new Error(`App não montou em ${path}`);
    } catch (err) {
      lastError = err;
    }
    await page.waitForTimeout(750);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
