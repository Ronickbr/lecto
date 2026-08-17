import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({ schoolId: z.string().min(1) });

export const getPlanUsageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => schema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPlanUsage } = await import("./plan-limits.server");
    return getPlanUsage(supabaseAdmin, data.schoolId);
  });
