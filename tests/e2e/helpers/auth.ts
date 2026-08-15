import type { BrowserContext, Page } from "@playwright/test";

/**
 * Restaura uma sessão pré-injetada (quando disponível) para que rotas /app
 * possam ser auditadas logadas. Retorna false quando não há sessão injetada.
 *
 * Em CI, injete as variáveis abaixo com uma sessão Supabase válida:
 *  - E2E_SUPABASE_STORAGE_KEY  (chave do localStorage usada pelo cliente)
 *  - E2E_SUPABASE_SESSION_JSON (JSON da sessão)
 *  - E2E_SUPABASE_COOKIES_JSON (lista de cookies, opcional)
 *  - E2E_AUTH_STATUS            ("injected" quando há sessão)
 */
export async function restoreSession(
  context: BrowserContext,
  page: Page,
  baseURL: string,
): Promise<boolean> {
  const storageKey = process.env.E2E_SUPABASE_STORAGE_KEY;
  const sessionJson = process.env.E2E_SUPABASE_SESSION_JSON;
  const cookiesJson = process.env.E2E_SUPABASE_COOKIES_JSON;

  if (!storageKey && !cookiesJson) return false;

  if (cookiesJson) {
    try {
      const cookies = JSON.parse(cookiesJson).map((c: Record<string, unknown>) => ({
        ...c,
        url: baseURL,
      }));
      await context.addCookies(cookies);
    } catch {
      /* ignore malformed cookie payloads */
    }
  }

  await page.goto(baseURL);
  if (storageKey && sessionJson) {
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [storageKey, sessionJson],
    );
  }
  return true;
}

export function hasSession(): boolean {
  return (
    process.env.E2E_AUTH_STATUS === "injected" && Boolean(process.env.E2E_SUPABASE_SESSION_JSON)
  );
}
