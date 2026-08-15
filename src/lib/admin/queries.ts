import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  computeHealth,
  monthKey,
  type Health,
  type PlanTier,
  type SubscriptionStatus,
} from "./format";

export interface SchoolRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  created_at: string;
  subscription_status: SubscriptionStatus;
  subscription_expires_at: string | null;
  plan_id: string | null;
  planName: string | null;
  planTier: PlanTier | null;
  planPriceCents: number;
  students: number;
  teachers: number;
  classes: number;
  simulados: number;
  attempts30d: number;
  lastAccess: string | null;
  health: Health;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
}

const THIRTY_DAYS = 30 * 86_400_000;
const PAGE = 1000;
const MAX_ROWS = 20_000;

/**
 * O PostgREST devolve no máximo 1000 linhas por requisição: sem paginação os
 * contadores do painel ficavam silenciosamente errados assim que a base crescia.
 */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Carrega, em poucas consultas, tudo que o painel do super admin precisa
 * sobre as escolas e agrega os números no cliente (volume por tenant é baixo).
 */
export function useAdminSchools() {
  return useQuery({
    queryKey: ["admin-schools-full"],
    staleTime: 60_000,
    queryFn: async (): Promise<SchoolRow[]> => {
      const [schools, plansRes, students, teachers, classes, simulados, attempts] =
        await Promise.all([
          fetchAll((f, t) =>
            supabase
              .from("schools")
              .select("*")
              .order("created_at", { ascending: false })
              .range(f, t),
          ),
          supabase.from("plans").select("id, name, tier, price_cents"),
          fetchAll((f, t) => supabase.from("students").select("id, school_id").range(f, t)),
          fetchAll((f, t) =>
            supabase
              .from("teachers")
              .select("id, school_id, full_name, email, user_id")
              .range(f, t),
          ),
          fetchAll((f, t) => supabase.from("classes").select("id, school_id").range(f, t)),
          fetchAll((f, t) => supabase.from("simulados").select("id, school_id").range(f, t)),
          fetchAll((f, t) =>
            supabase
              .from("simulado_attempts")
              .select("id, school_id, started_at, submitted_at")
              .range(f, t),
          ),
        ]);

      const plans = new Map((plansRes.data ?? []).map((p) => [p.id, p]));
      const tally = <T extends { school_id: string }>(rows: T[] | null) => {
        const m = new Map<string, number>();
        (rows ?? []).forEach((r) => m.set(r.school_id, (m.get(r.school_id) ?? 0) + 1));
        return m;
      };

      const studentCount = tally(students);
      const teacherCount = tally(teachers);
      const classCount = tally(classes);
      const simuladoCount = tally(simulados);

      const attempts30d = new Map<string, number>();
      const lastAccess = new Map<string, string>();
      const cutoff = Date.now() - THIRTY_DAYS;
      attempts.forEach((a) => {
        const t = new Date(a.started_at).getTime();
        if (t >= cutoff) attempts30d.set(a.school_id, (attempts30d.get(a.school_id) ?? 0) + 1);
        const prev = lastAccess.get(a.school_id);
        if (!prev || new Date(prev).getTime() < t) lastAccess.set(a.school_id, a.started_at);
      });

      const owners = new Map<string, { name: string; email: string }>();
      teachers.forEach((t) => {
        if (!owners.has(t.school_id))
          owners.set(t.school_id, { name: t.full_name, email: t.email });
      });

      return schools.map((s) => {
        const plan = s.plan_id ? plans.get(s.plan_id) : undefined;
        const owner = owners.get(s.id);
        const last = lastAccess.get(s.id) ?? null;
        return {
          id: s.id,
          name: s.name,
          slug: s.slug,
          city: s.city,
          state: s.state,
          logo_url: s.logo_url,
          created_at: s.created_at,
          subscription_status: s.subscription_status,
          subscription_expires_at: s.subscription_expires_at,
          plan_id: s.plan_id,
          planName: plan?.name ?? null,
          planTier: (plan?.tier as PlanTier | undefined) ?? null,
          planPriceCents: plan?.price_cents ?? 0,
          students: studentCount.get(s.id) ?? 0,
          teachers: teacherCount.get(s.id) ?? 0,
          classes: classCount.get(s.id) ?? 0,
          simulados: simuladoCount.get(s.id) ?? 0,
          attempts30d: attempts30d.get(s.id) ?? 0,
          lastAccess: last,
          health: computeHealth({
            lastAccess: last,
            attempts30d: attempts30d.get(s.id) ?? 0,
            students: studentCount.get(s.id) ?? 0,
          }),
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          ownerPhone: s.cnpj ? null : null,
        };
      });
    },
  });
}

export interface AttemptPoint {
  id: string;
  school_id: string;
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
}

export function useAdminActivity() {
  return useQuery({
    queryKey: ["admin-activity"],
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
      const [attempts, answers] = await Promise.all([
        fetchAll<AttemptPoint>((f, t) =>
          supabase
            .from("simulado_attempts")
            .select("id, school_id, started_at, submitted_at, graded_at")
            .gte("started_at", since)
            .range(f, t),
        ),
        fetchAll<{ id: string; created_at: string }>((f, t) =>
          supabase
            .from("simulado_answers")
            .select("id, created_at")
            .gte("created_at", since)
            .range(f, t),
        ),
      ]);
      return { attempts, answers };
    },
  });
}

/** Receita mensal recorrente = soma dos planos de escolas ativas. */
export function computeFinance(schools: SchoolRow[]) {
  const active = schools.filter((s) => s.subscription_status === "active");
  const mrrCents = active.reduce((acc, s) => acc + s.planPriceCents, 0);
  const trials = schools.filter((s) => s.subscription_status === "trial").length;
  const cancelled = schools.filter((s) => s.subscription_status === "cancelled").length;
  const suspended = schools.filter((s) => s.subscription_status === "suspended").length;
  const churn = schools.length ? (cancelled / schools.length) * 100 : 0;
  const conversion = trials + active.length ? (active.length / (trials + active.length)) * 100 : 0;
  const arpaCents = active.length ? mrrCents / active.length : 0;
  return {
    mrrCents,
    arrCents: mrrCents * 12,
    trials,
    cancelled,
    suspended,
    activeCount: active.length,
    churn,
    conversion,
    arpaCents,
    ltvCents: churn > 0 ? arpaCents / (churn / 100) : arpaCents * 24,
  };
}

export function groupByMonth(
  items: { created_at?: string; started_at?: string }[],
  keys: { key: string }[],
) {
  const m = new Map(keys.map((k) => [k.key, 0]));
  items.forEach((i) => {
    const iso = i.created_at ?? i.started_at;
    if (!iso) return;
    const k = monthKey(iso);
    if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
  });
  return m;
}
