import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  delta?: number | null;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  loading,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "group rounded-2xl border-border/70 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{label}</p>
          {Icon && (
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4" />
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {loading ? (
            <span className="inline-block h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : (
            <span className="font-display text-2xl leading-none tracking-tight sm:text-3xl">
              {value}
            </span>
          )}
          {typeof delta === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>
        {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function ChartCard({
  title,
  description,
  action,
  children,
  height = 260,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  height?: number;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-soft transition-shadow hover:shadow-lg">
      <CardContent className="p-5">
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
        <div style={{ height }} className="w-full">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
