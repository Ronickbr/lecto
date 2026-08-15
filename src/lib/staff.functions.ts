import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CreateSchoolSchema, CreateTeacherSchema } from "./staff.schemas.server";

// ============================================================
// Super admin creates a school AND a school_admin user for it
// ============================================================

export const createSchoolFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CreateSchoolSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Apenas o administrador geral pode criar escolas");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create school
    const { data: school, error: sErr } = await supabaseAdmin
      .from("schools")
      .insert({
        name: data.name,
        slug: data.slug,
        cnpj: data.cnpj ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        plan_id: data.planId ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (sErr) throw new Error(sErr.message);

    // Create or fetch admin user
    let userId: string | null = null;
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const match = existing.users.find(
      (u) => u.email?.toLowerCase() === data.adminEmail.toLowerCase(),
    );
    if (match) {
      userId = match.id;
    } else {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.adminEmail,
        password: data.adminPassword,
        email_confirm: true,
        user_metadata: { full_name: data.adminName },
      });
      if (cErr || !created.user) {
        await supabaseAdmin.from("schools").delete().eq("id", school.id);
        throw new Error(cErr?.message ?? "Falha ao criar admin");
      }
      userId = created.user.id;
    }

    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "school_admin",
      school_id: school.id,
    });

    return { schoolId: school.id, adminUserId: userId };
  });

// ============================================================
// School admin creates a teacher (provisions auth user)
// ============================================================

export const createTeacherFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CreateTeacherSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    let allowed = isSuper === true;
    if (!allowed) {
      const { data: schoolId } = await context.supabase.rpc("user_school_id", {
        _user_id: context.userId,
      });
      const { data: isSchoolAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "school_admin",
      });
      allowed = schoolId === data.schoolId && isSchoolAdmin === true;
    }
    if (!allowed) throw new Error("Sem permissão");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null;
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const match = existing.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (match) {
      userId = match.id;
    } else {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (cErr || !created.user) throw new Error(cErr?.message ?? "Falha ao criar usuário");
      userId = created.user.id;
    }

    const { data: teacher, error: tErr } = await supabaseAdmin
      .from("teachers")
      .insert({
        school_id: data.schoolId,
        user_id: userId,
        full_name: data.fullName,
        email: data.email,
        subjects: data.subjects,
      })
      .select()
      .single();
    if (tErr) throw new Error(tErr.message);

    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "teacher",
      school_id: data.schoolId,
    });

    return { teacherId: teacher.id };
  });
