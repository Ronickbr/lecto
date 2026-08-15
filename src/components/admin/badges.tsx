import { cn } from "@/lib/utils";
import {
  HEALTH_LABEL,
  STATUS_LABEL,
  TIER_LABEL,
  type Health,
  type PlanTier,
  type SubscriptionStatus,
} from "@/lib/admin/format";

const base =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

function Dot({ className }: { className?: string }) {
  return <span className={cn("size-1.5 shrink-0 rounded-full", className)} aria-hidden />;
}

const STATUS_STYLE: Record<SubscriptionStatus, { wrap: string; dot: string }> = {
  active: {
    wrap: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  trial: {
    wrap: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  suspended: {
    wrap: "border-destructive/25 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  cancelled: { wrap: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

export function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.cancelled;
  return (
    <span className={cn(base, s.wrap)}>
      <Dot className={s.dot} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const TIER_STYLE: Record<PlanTier, { wrap: string; dot: string }> = {
  enterprise: {
    wrap: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  pro: { wrap: "border-primary/25 bg-primary/10 text-primary", dot: "bg-primary" },
  basic: {
    wrap: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  free: { wrap: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

export function PlanBadge({ tier, name }: { tier?: PlanTier | null; name?: string | null }) {
  if (!tier) return <span className="text-sm text-muted-foreground">Sem plano</span>;
  const s = TIER_STYLE[tier] ?? TIER_STYLE.free;
  return (
    <span className={cn(base, s.wrap)}>
      <Dot className={s.dot} />
      {name ?? TIER_LABEL[tier]}
    </span>
  );
}

const HEALTH_STYLE: Record<Health, { wrap: string; dot: string }> = {
  healthy: {
    wrap: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  low: {
    wrap: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  inactive: {
    wrap: "border-destructive/25 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export function HealthBadge({ health }: { health: Health }) {
  const s = HEALTH_STYLE[health];
  return (
    <span className={cn(base, s.wrap)}>
      <Dot className={s.dot} />
      {HEALTH_LABEL[health]}
    </span>
  );
}
