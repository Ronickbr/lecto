import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProvisionInput = z
  .object({
    schoolName: z.string().trim().max(120).optional(),
  })
  .nullish()
  .default({});

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
  .validator((raw: unknown) => ProvisionInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .limit(1);
    if ((existingRoles?.length ?? 0) > 0) {
      return { ok: true, provisioned: false, schoolId: null };
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const rawMeta = authUser?.user?.user_metadata ?? {};

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();

    const profileFullName = profile?.full_name ?? null;
    const metaFullName = typeof rawMeta.full_name === "string" ? rawMeta.full_name : null;
    const emailPrefix = authUser?.user?.email ? authUser.user.email.split("@")[0] : null;
    const fullName: string = profileFullName || metaFullName || emailPrefix || "Escola";

    const { data: trialPlan } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("tier", "free")
      .eq("active", true)
      .maybeSingle();
    if (!trialPlan) {
      throw new Error(
        "Plano Trial (tier=free, active=true) não encontrado na tabela plans. " +
          "Execute a migration 0027_trial_plan.sql ou insira o registro manualmente.",
      );
    }

    const schoolNameFromValidator = data?.schoolName?.trim() ?? "";
    const schoolNameFromMeta = typeof rawMeta.school_name === "string" ? rawMeta.school_name.trim() : "";
    const trimmedSchoolName = schoolNameFromValidator || schoolNameFromMeta;
    const finalSchoolName = trimmedSchoolName || `Escola de ${fullName}`;

    const base = slugify(trimmedSchoolName || fullName) || "escola";
    const slug = `${base}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`;

    const { data: school, error: sErr } = await supabaseAdmin
      .from("schools")
      .insert({
        name: finalSchoolName,
        slug,
        plan_id: trialPlan.id,
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
      throw new Error(`Falha ao atribuir papel school_admin: ${roleErr.message}`);
    }

    if (!profile) {
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
