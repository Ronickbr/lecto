import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Provisiona uma conta criada diretamente pelo Auth como administrador de
 * escola: cria uma escola em trial (1 professor, 25 alunos e até 5 simulados
 * por mês) e atribui o papel `school_admin` ao usuário.
 *
 * A trigger `handle_new_user` só cria o perfil e nunca atribui papéis; sem
 * este provisionamento o usuário cairia em "/app" sem papel ("Sem papel
 * atribuído. Contate o suporte.").
 *
 * Idempotente e seguro: usuários que já possuem qualquer papel não geram nova
 * escola (também protege contas criadas pelo super admin/outros fluxos).
 */
export const provisionSchoolAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Já provisionado (qualquer papel) → no-op.
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .limit(1);
    if ((existingRoles?.length ?? 0) > 0) {
      return { ok: true, provisioned: false, schoolId: null };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const fullName = profile?.full_name ?? "Escola";

    const { data: trialPlan } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("tier", "free")
      .eq("active", true)
      .maybeSingle();

    const base = slugify(fullName) || "escola";
    const slug = `${base}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`;

    const { data: school, error: sErr } = await supabaseAdmin
      .from("schools")
      .insert({
        name: `Escola de ${fullName}`,
        slug,
        plan_id: trialPlan?.id ?? null,
        subscription_status: "trial",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(`Falha ao criar escola: ${sErr.message}`);

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: context.userId,
      role: "school_admin",
      school_id: school.id,
    });
    if (roleErr) {
      await supabaseAdmin.from("schools").delete().eq("id", school.id);
      throw new Error(`Falha ao atribuir papel: ${roleErr.message}`);
    }

    // Garante o perfil (a trigger handle_new_user normalmente já cria).
    if (!profile) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      await supabaseAdmin.from("profiles").upsert({
        id: context.userId,
        full_name: fullName,
        email: authUser?.user?.email ?? null,
      });
    }

    return { ok: true, provisioned: true, schoolId: school.id };
  });

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
