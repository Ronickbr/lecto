import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Garante que o usuário atual pode administrar a escola informada.
 * Super admin sempre pode; school_admin apenas na própria escola.
 */
export async function assertCanManageSchool(
  supabase: SupabaseClient,
  userId: string,
  schoolId: string,
  { allowTeacher = false }: { allowTeacher?: boolean } = {},
) {
  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (isSuper === true) return;

  const { data: ownSchool } = await supabase.rpc("user_school_id", { _user_id: userId });
  if (ownSchool !== schoolId) throw new Error("Sem permissão nesta escola");

  const { data: isSchoolAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "school_admin",
  });
  if (isSchoolAdmin === true) return;

  if (allowTeacher) {
    const { data: isTeacher } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "teacher",
    });
    if (isTeacher === true) return;
  }

  throw new Error("Sem permissão");
}

/**
 * Permissão para gerir alunos.
 * Super admin e school_admin: qualquer aluno da escola.
 * Professor: apenas alunos das turmas em que ele é o responsável.
 */
export async function assertCanManageStudent(
  supabase: SupabaseClient,
  userId: string,
  schoolId: string,
  classIds: (string | null | undefined)[],
) {
  try {
    await assertCanManageSchool(supabase, userId, schoolId);
    return;
  } catch {
    /* segue para a checagem de professor */
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!teacher) throw new Error("Sem permissão nesta escola");

  const ids = classIds.filter(Boolean) as string[];
  if (ids.length !== classIds.length) {
    throw new Error("Professores devem vincular o aluno a uma de suas turmas");
  }
  const unique = Array.from(new Set(ids));
  const { data: owned } = await supabase
    .from("classes")
    .select("id")
    .eq("teacher_id", teacher.id)
    .in("id", unique);
  const allowed = new Set((owned ?? []).map((c) => c.id));
  for (const id of unique) {
    if (!allowed.has(id)) throw new Error("Você só pode gerenciar alunos das suas turmas");
  }
}

/**
 * Resolve a escola associada para geração de conteúdo por IA.
 */
export async function resolveSchoolIdForGeneration(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: ownSchool } = await supabase.rpc("user_school_id", { _user_id: userId });
  if (ownSchool) return ownSchool;

  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (isSuper) {
    const { data: school } = await supabase.from("schools").select("id").limit(1).single();
    if (school?.id) return school.id;
  }

  throw new Error("Escola não associada para geração de conteúdo");
}

