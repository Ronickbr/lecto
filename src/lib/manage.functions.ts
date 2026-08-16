import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============================================================
// PROFESSORES
// ============================================================
export const updateTeacherFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        teacherId: z.string().uuid(),
        fullName: z.string().min(1),
        subjects: z.array(z.string().max(60)).max(20).default([]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertCanManageSchool } = await import("./manage.server");

    const { data: teacher } = await supabaseAdmin
      .from("teachers")
      .select("id, school_id, user_id")
      .eq("id", data.teacherId)
      .maybeSingle();
    if (!teacher) throw new Error("Professor não encontrado");
    await assertCanManageSchool(context.supabase, context.userId, teacher.school_id);

    const { error } = await supabaseAdmin
      .from("teachers")
      .update({ full_name: data.fullName, subjects: data.subjects })
      .eq("id", teacher.id);
    if (error) throw new Error(error.message);

    if (teacher.user_id) {
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.fullName })
        .eq("id", teacher.user_id);
      if (pErr) console.error("updateTeacherFn: profiles", pErr.message);
    }
    return { ok: true };
  });

export const resetTeacherPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ teacherId: z.string().uuid(), password: z.string().min(6) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertCanManageSchool } = await import("./manage.server");

    const { data: teacher } = await supabaseAdmin
      .from("teachers")
      .select("id, school_id, user_id")
      .eq("id", data.teacherId)
      .maybeSingle();
    if (!teacher?.user_id) throw new Error("Professor sem conta de acesso");
    await assertCanManageSchool(context.supabase, context.userId, teacher.school_id);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(teacher.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTeacherFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ teacherId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertCanManageSchool } = await import("./manage.server");

    const { data: teacher } = await supabaseAdmin
      .from("teachers")
      .select("id, school_id, user_id")
      .eq("id", data.teacherId)
      .maybeSingle();
    if (!teacher) throw new Error("Professor não encontrado");
    await assertCanManageSchool(context.supabase, context.userId, teacher.school_id);

    const { error: cErr } = await supabaseAdmin
      .from("classes")
      .update({ teacher_id: null })
      .eq("teacher_id", teacher.id);
    if (cErr) throw new Error(`Falha ao desvincular turmas: ${cErr.message}`);

    const { error: dErr } = await supabaseAdmin.from("teachers").delete().eq("id", teacher.id);
    if (dErr) throw new Error(`Falha ao remover professor: ${dErr.message}`);

    if (teacher.user_id) {
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", teacher.user_id)
        .eq("role", "teacher")
        .eq("school_id", teacher.school_id);
      if (rErr) throw new Error(`Falha ao remover papel do professor: ${rErr.message}`);
      const { error: uErr } = await supabaseAdmin.auth.admin.deleteUser(teacher.user_id);
      if (uErr)
        throw new Error(`Professor removido, mas a conta de acesso permaneceu: ${uErr.message}`);
    }
    return { ok: true };
  });

// ============================================================
// ALUNOS
// ============================================================
export const updateStudentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        fullName: z.string().min(1),
        studentCode: z.string().min(1),
        classId: z.string().uuid().nullable(),
        birthDate: z.string().nullable().optional(),
        guardianEmail: z
          .union([z.string().email(), z.literal("")])
          .nullable()
          .optional(),
        guardianPhone: z.string().max(30).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, school_id, user_id, class_id")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Aluno não encontrado");
    const { assertCanManageStudent } = await import("./manage.server");
    await assertCanManageStudent(context.supabase, context.userId, student.school_id, [
      student.class_id,
      data.classId,
    ]);

    const { error } = await supabaseAdmin
      .from("students")
      .update({ full_name: data.fullName, student_code: data.studentCode, class_id: data.classId })
      .eq("id", student.id);
    if (error) throw new Error(error.message);

    const { error: credErr } = await supabaseAdmin
      .from("student_credentials")
      .update({
        birth_date: data.birthDate || null,
        guardian_email: data.guardianEmail || null,
        guardian_phone: data.guardianPhone || null,
      })
      .eq("student_id", student.id);
    if (credErr) throw new Error(`Falha ao atualizar dados do responsável: ${credErr.message}`);

    if (student.user_id) {
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.fullName })
        .eq("id", student.user_id);
      if (pErr) console.error("updateStudentFn: profiles", pErr.message);
    }
    return { ok: true };
  });

export const resetStudentPinFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ studentId: z.string().uuid(), pin: z.string().min(4).max(10) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, school_id, class_id")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Aluno não encontrado");
    const { assertCanManageStudent } = await import("./manage.server");
    await assertCanManageStudent(context.supabase, context.userId, student.school_id, [
      student.class_id,
    ]);

    const { data: pinHash, error: hashErr } = await supabaseAdmin.rpc("hash_pin", {
      _pin: data.pin,
    });
    if (hashErr || !pinHash) throw new Error("Falha ao gerar novo PIN");

    const { error } = await supabaseAdmin
      .from("student_credentials")
      .update({ pin_hash: pinHash as unknown as string })
      .eq("student_id", student.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ studentId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, school_id, user_id, class_id")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Aluno não encontrado");
    const { assertCanManageStudent } = await import("./manage.server");
    await assertCanManageStudent(context.supabase, context.userId, student.school_id, [
      student.class_id,
    ]);

    const { error: credErr } = await supabaseAdmin
      .from("student_credentials")
      .delete()
      .eq("student_id", student.id);
    if (credErr) throw new Error(`Falha ao remover credenciais: ${credErr.message}`);

    const { error: sErr } = await supabaseAdmin.from("students").delete().eq("id", student.id);
    if (sErr) throw new Error(`Falha ao remover aluno: ${sErr.message}`);

    if (student.user_id) {
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", student.user_id)
        .eq("role", "student");
      if (rErr) throw new Error(`Falha ao remover papel do aluno: ${rErr.message}`);
      const { error: uErr } = await supabaseAdmin.auth.admin.deleteUser(student.user_id);
      if (uErr)
        throw new Error(`Aluno removido, mas a conta de acesso permaneceu: ${uErr.message}`);
    }
    return { ok: true };
  });

// ============================================================
// IMPORTAÇÃO EM LOTE DE ALUNOS (CSV)
// ============================================================
export const bulkImportStudentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        schoolId: z.string().uuid(),
        classId: z.string().uuid().nullable(),
        rows: z
          .array(
            z.object({
              fullName: z.string().min(1),
              studentCode: z.string().min(1),
              pin: z.string().min(4).max(10),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertCanManageStudent } = await import("./manage.server");
    await assertCanManageStudent(context.supabase, context.userId, data.schoolId, [data.classId]);

    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("slug")
      .eq("id", data.schoolId)
      .maybeSingle();
    if (!school) throw new Error("Escola inválida");

    let created = 0;
    const errors: string[] = [];

    // Deduplica códigos repetidos no próprio arquivo antes de tocar o banco.
    const seen = new Set<string>();
    const rows: typeof data.rows = [];
    for (const row of data.rows) {
      const code = row.studentCode.trim().toLowerCase();
      if (seen.has(code)) {
        errors.push(`${row.studentCode}: código duplicado no arquivo`);
        continue;
      }
      seen.add(code);
      rows.push(row);
    }

    const importRow = async (row: (typeof rows)[number]) => {
      try {
        const authEmail = `student-${row.studentCode.toLowerCase()}-${school.slug}@students.lecto.local`;
        const { data: user, error: uErr } = await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          password: crypto.randomUUID() + crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { full_name: row.fullName, kind: "student" },
        });
        if (uErr || !user.user) throw new Error(uErr?.message ?? "Falha ao criar usuário");

        const { data: pinHash } = await supabaseAdmin.rpc("hash_pin", { _pin: row.pin });
        const { data: student, error: sErr } = await supabaseAdmin
          .from("students")
          .insert({
            school_id: data.schoolId,
            class_id: data.classId,
            user_id: user.user.id,
            full_name: row.fullName,
            student_code: row.studentCode,
          })
          .select()
          .single();
        if (sErr) {
          await supabaseAdmin.auth.admin.deleteUser(user.user.id);
          throw new Error(sErr.message);
        }

        const { error: credErr } = await supabaseAdmin.from("student_credentials").insert({
          student_id: student.id,
          pin_hash: pinHash as unknown as string,
          auth_email: authEmail,
        });
        if (credErr) throw new Error(credErr.message);

        const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
          user_id: user.user.id,
          role: "student",
          school_id: data.schoolId,
        });
        if (roleErr) throw new Error(roleErr.message);
        created += 1;
      } catch (e) {
        errors.push(`${row.studentCode}: ${e instanceof Error ? e.message : "erro"}`);
      }
    };

    // Lotes pequenos em paralelo: evita ~1000 chamadas sequenciais numa importação grande.
    const CHUNK = 5;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await Promise.all(rows.slice(i, i + CHUNK).map(importRow));
    }

    return { created, errors };
  });
