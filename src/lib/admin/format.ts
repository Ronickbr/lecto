import type { Database } from "@/integrations/supabase/types";

export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
export type PlanTier = Database["public"]["Enums"]["plan_tier"];

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export const num = (v: number) => v.toLocaleString("pt-BR");

export function fullDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function shortDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function relative(iso?: string | null) {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  return `há ${Math.floor(months / 12)} ano(s)`;
}

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Ativa",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

export const TIER_LABEL: Record<PlanTier, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

export type Health = "healthy" | "low" | "inactive";

/** Saúde derivada de uso real: último acesso, simulados e volume de alunos. */
export function computeHealth(input: {
  lastAccess?: string | null;
  attempts30d: number;
  students: number;
}): Health {
  const days = input.lastAccess
    ? Math.floor((Date.now() - new Date(input.lastAccess).getTime()) / 86_400_000)
    : Infinity;
  if (days > 30 || (input.attempts30d === 0 && input.students === 0)) return "inactive";
  if (days > 10 || input.attempts30d < 3) return "low";
  return "healthy";
}

export const HEALTH_LABEL: Record<Health, string> = {
  healthy: "Saudável",
  low: "Baixo uso",
  inactive: "Inativa",
};

/** Últimos N meses no formato { key: "2026-01", label: "jan/26" }. */
export function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    });
  }
  return out;
}

export function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastDays(n: number) {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    });
  }
  return out;
}

export const dateShort = shortDate;

/** Converte linhas em CSV com cabeçalho em português. */
export function toCsv<T>(rows: T[], cols: { key: keyof T; label: string }[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    cols.map((c) => esc(c.label)).join(";"),
    ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(";")),
  ].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
