import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAiApiKey, getAiBaseUrl } from "./ai-gateway.server";

export const testAiConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Apenas o administrador geral pode testar integrações");

    const key = getAiApiKey();
    if (!key) {
      return { ok: false as const, status: 0, message: "Missing AI_API_KEY" };
    }

    let baseUrl: string;
    try {
      baseUrl = getAiBaseUrl();
    } catch {
      return { ok: false as const, status: 0, message: "Missing AI_BASE_URL" };
    }

    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const body = await res.text();
      return {
        ok: res.ok as boolean,
        status: res.status,
        message: res.ok ? "OK" : body.slice(0, 300),
      };
    } catch (error) {
      return {
        ok: false as const,
        status: 0,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
