import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Regras de limites por plano contratado.
 *
 * Os limites vivem em colunas da tabela `plans` (max_schools, max_teachers,
 * max_students, max_simulados_month). Este módulo é o único lugar que traduz
 * esses números em bloqueios no momento de criar recursos — tanto no painel do
 * super admin quanto no painel da escola.
 */

export type PlanResource = "teachers" | "students" | "simulados_month";

const MAX_COLUMN: Record<PlanResource, "max_teachers" | "max_students" | "max_simulados_month"> = {
  teachers: "max_teachers",
  students: "max_students",
  simulados_month: "max_simulados_month",
};

const LIMIT_MSG: Record<PlanResource, (max: number) => string> = {
  teachers: (max) =>
    `O plano contratado permite no máximo ${max} professor(es). Remova professores ou contrate um plano superior.`,
  students: (max) =>
    `O plano contratado permite no máximo ${max} aluno(s). Remova alunos ou contrate um plano superior.`,
  simulados_month: (max) => `O plano contratado permite no máximo ${max} simulado(s) por mês.`,
};

/** Escola + plano contratado (nome e limites). Sem plano, `plans` é null. */
export async function getSchoolWithPlan(supabaseAdmin: SupabaseClient<Database>, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select(
      "id, plan_id, subscription_status, plans(name, max_teachers, max_students, max_simulados_month)",
    )
    .eq("id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Conta quantos registros do recurso a escola já possui. */
export async function countResource(
  supabaseAdmin: SupabaseClient<Database>,
  schoolId: string,
  resource: PlanResource,
): Promise<number> {
  if (resource === "simulados_month") {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("simulados")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("created_at", start.toISOString());
    return count ?? 0;
  }
  const { count } =
    resource === "teachers"
      ? await supabaseAdmin
          .from("teachers")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
      : await supabaseAdmin
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId);
  return count ?? 0;
}

export interface PlanUsage {
  schoolId: string;
  planName: string | null;
  maxTeachers: number | null;
  maxStudents: number | null;
  maxSimuladosMonth: number | null;
  teachers: number;
  students: number;
  simuladosMonth: number;
}

/** Uso atual da escola + limites do plano contratado (para exibição e checagens). */
export async function getPlanUsage(
  supabaseAdmin: SupabaseClient<Database>,
  schoolId: string,
): Promise<PlanUsage> {
  const school = await getSchoolWithPlan(supabaseAdmin, schoolId);
  if (!school) throw new Error("Escola não encontrada");
  const plan = school.plans;
  const [teachers, students, simuladosMonth] = await Promise.all([
    countResource(supabaseAdmin, schoolId, "teachers"),
    countResource(supabaseAdmin, schoolId, "students"),
    countResource(supabaseAdmin, schoolId, "simulados_month"),
  ]);
  return {
    schoolId,
    planName: plan?.name ?? null,
    maxTeachers: plan?.max_teachers ?? null,
    maxStudents: plan?.max_students ?? null,
    maxSimuladosMonth: plan?.max_simulados_month ?? null,
    teachers,
    students,
    simuladosMonth,
  };
}

/**
 * Bloqueia a criação quando `count + extra` excederia o limite do plano.
 * Sem plano contratado, nenhum limite é aplicado.
 */
export async function assertResourceLimit(
  supabaseAdmin: SupabaseClient<Database>,
  schoolId: string,
  resource: PlanResource,
  extra = 1,
): Promise<void> {
  const school = await getSchoolWithPlan(supabaseAdmin, schoolId);
  if (!school) throw new Error("Escola não encontrada");
  if (!school.plans) return;
  const max = school.plans[MAX_COLUMN[resource]];
  const count = await countResource(supabaseAdmin, schoolId, resource);
  if (count + extra > max) throw new Error(LIMIT_MSG[resource](max));
}

/**
 * Bloqueia associar mais escolas a um plano quando o plano já atingiu a sua
 * cota de escolas (max_schools). Considera apenas escolas trial/ativas.
 */
export async function assertPlanSchoolCapacity(
  supabaseAdmin: SupabaseClient<Database>,
  planId: string,
): Promise<void> {
  const { data: plan, error } = await supabaseAdmin
    .from("plans")
    .select("name, max_schools")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  if (!plan) throw new Error("Plano inválido");

  const { count } = await supabaseAdmin
    .from("schools")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId)
    .in("subscription_status", ["trial", "active"]);

  if ((count ?? 0) >= plan.max_schools) {
    throw new Error(`O plano ${plan.name} já atingiu o limite de ${plan.max_schools} escola(s).`);
  }
}

/**
 * Bloqueia a troca de plano quando o uso atual da escola já excede os limites
 * do novo plano (impede downgrade abaixo do uso existente).
 */
export async function assertPlanFitsUsage(
  supabaseAdmin: SupabaseClient<Database>,
  schoolId: string,
  planId: string,
): Promise<void> {
  const usage = await getPlanUsage(supabaseAdmin, schoolId);

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("name, max_teachers, max_students, max_simulados_month")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return;

  const over: string[] = [];
  if (usage.teachers > plan.max_teachers)
    over.push(`${usage.teachers} professores (limite ${plan.max_teachers})`);
  if (usage.students > plan.max_students)
    over.push(`${usage.students} alunos (limite ${plan.max_students})`);
  if (usage.simuladosMonth > plan.max_simulados_month)
    over.push(`${usage.simuladosMonth} simulados no mês (limite ${plan.max_simulados_month})`);
  if (over.length) {
    throw new Error(
      `A escola excede os limites do plano ${plan.name}: ${over.join(", ")}. Eleve o plano ou reduza o uso antes de trocar.`,
    );
  }
}
