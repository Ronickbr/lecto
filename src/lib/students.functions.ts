import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SignInSchema, CreateStudentSchema } from "./students.schemas.server";
import { rateLimit } from "./rate-limit.server";

// ============================================================
// PUBLIC: Student sign-in via class_code + student_code + PIN
// Returns synthesized credentials the client uses with signInWithPassword.
// PIN is verified server-side via pgcrypto; the auth password is rotated
// on every successful login so the PIN itself is never brute-forceable
// through supabase.auth.signInWithPassword.
// ============================================================

const PIN_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 5 * 60 * 1000, // 5 attempts per 5 minutes
  lockMs: 15 * 60 * 1000, // then lock for 15 minutes
};

export const studentSignInFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SignInSchema.parse(raw))
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const bucket = rateLimit({
      key: `pin:${ip}:${data.classCode}:${data.studentCode}`,
      maxAttempts: PIN_RATE_LIMIT.maxAttempts,
      windowMs: PIN_RATE_LIMIT.windowMs,
      lockMs: PIN_RATE_LIMIT.lockMs,
    });
    if (!bucket.allowed) {
      throw new Error("Muitas tentativas. Tente novamente em alguns minutos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: klass } = await supabaseAdmin
      .from("classes")
      .select("id, school_id")
      .eq("class_code", data.classCode)
      .maybeSingle();
    if (!klass) throw new Error("Turma não encontrada");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, class_id, full_name")
      .eq("school_id", klass.school_id)
      .eq("student_code", data.studentCode)
      .maybeSingle();
    if (!student) throw new Error("Aluno não encontrado nessa turma");
    if (student.class_id && student.class_id !== klass.id) {
      throw new Error("Aluno não pertence a essa turma");
    }

    const { data: creds } = await supabaseAdmin
      .from("student_credentials")
      .select("auth_email")
      .eq("student_id", student.id)
      .maybeSingle();
    if (!creds?.auth_email) {
      throw new Error("Conta do aluno não provisionada");
    }

    const { data: ok, error: vErr } = await supabaseAdmin.rpc("verify_student_pin", {
      _student_id: student.id,
      _pin: data.pin,
    });
    if (vErr) throw new Error("Falha na verificação do PIN");
    if (!ok) throw new Error("PIN incorreto");

    // Rotate password so the client-side signInWithPassword can consume it once.
    const newPassword = crypto.randomUUID() + crypto.randomUUID();
    // Look up the auth user by email (students.user_id is no longer stored on the row we selected).
    const { data: userByEmail } = await supabaseAdmin
      .from("students")
      .select("user_id")
      .eq("id", student.id)
      .maybeSingle();
    if (!userByEmail?.user_id) throw new Error("Conta do aluno não provisionada");

    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(userByEmail.user_id, {
      password: newPassword,
    });
    if (pwErr) throw new Error("Falha ao preparar sessão");

    return { email: creds.auth_email, password: newPassword, fullName: student.full_name };
  });

// ============================================================
// AUTHENTICATED: School admin creates a student
// ============================================================

export const createStudentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => CreateStudentSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { assertCanManageStudent } = await import("./manage.server");
    await assertCanManageStudent(context.supabase, context.userId, data.schoolId, [data.classId]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertResourceLimit } = await import("./plan-limits.server");
    await assertResourceLimit(supabaseAdmin, data.schoolId, "students");

    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("slug")
      .eq("id", data.schoolId)
      .maybeSingle();
    if (!school) throw new Error("Escola inválida");

    const authEmail = `student-${data.studentCode.toLowerCase()}-${school.slug}@students.lecto.local`;
    const tempPassword = crypto.randomUUID() + crypto.randomUUID();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, kind: "student" },
    });
    if (createErr || !created.user)
      throw new Error(createErr?.message ?? "Falha ao criar usuário do aluno");

    const { data: pinHash, error: hashErr } = await supabaseAdmin.rpc("hash_pin", {
      _pin: data.pin,
    });
    if (hashErr || !pinHash) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Falha ao gerar hash do PIN");
    }

    const { data: student, error: insErr } = await supabaseAdmin
      .from("students")
      .insert({
        school_id: data.schoolId,
        class_id: data.classId,
        user_id: created.user.id,
        full_name: data.fullName,
        student_code: data.studentCode,
      })
      .select()
      .single();
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(insErr.message);
    }

    const { error: credErr } = await supabaseAdmin.from("student_credentials").insert({
      student_id: student.id,
      pin_hash: pinHash as unknown as string,
      auth_email: authEmail,
      birth_date: data.birthDate || null,
      guardian_email: data.guardianEmail || null,
      guardian_phone: data.guardianPhone || null,
    });
    if (credErr) {
      await supabaseAdmin.from("students").delete().eq("id", student.id);
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(credErr.message);
    }

    await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: "student",
      school_id: data.schoolId,
    });

    return { id: student.id };
  });
