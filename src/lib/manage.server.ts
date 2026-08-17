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
 * Resolve um class_code único globalmente a partir de um código base,
 * apêndice "-1", "-2", … enquanto houver colisão. `excludeId` permite manter
 * o próprio código durante uma edição.
 */
export async function uniqueClassCode(
  admin: SupabaseClient,
  base: string,
  excludeId?: string,
): Promise<string> {
  for (let i = 0; ; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i}`;
    let query = admin.from("classes").select("id").eq("class_code", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }
}

/**
 * Resolve a escola alvo de uma operação administrativa sem confiar no valor
 * cru vindo do cliente.
 * - Super admin: aceita o `schoolId` explícito (UUID ou slug legado) e o
 *   normaliza para o UUID real da tabela schools.
 * - Demais papéis: deriva da própria conta via `user_school_id` (fail-closed
 *   quando a conta está em mais de uma escola).
 */
const SCHOOL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveOperationalSchool(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  requestedSchoolId?: string | null,
): Promise<string> {
  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (isSuper === true) {
    if (!requestedSchoolId) throw new Error("Selecione uma escola");
    const { data: school } = SCHOOL_UUID_RE.test(requestedSchoolId)
      ? await admin.from("schools").select("id").eq("id", requestedSchoolId).maybeSingle()
      : await admin.from("schools").select("id").eq("slug", requestedSchoolId).maybeSingle();
    if (!school) throw new Error("Escola inválida");
    return school.id;
  }

  const { data: ownSchool } = await supabase.rpc("user_school_id", { _user_id: userId });
  if (!ownSchool) throw new Error("Nenhuma escola associada à sua conta");
  return ownSchool;
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
