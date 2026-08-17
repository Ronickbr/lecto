import { toast } from "sonner";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toUserError } from "./to-user-error";
import type { UserError } from "./types";

/** Visual das notificações de erro (usado pelos toasts). */
export function ErrorToastView({ error }: { error: UserError }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{error.title}</p>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      {error.suggestion && (
        <p className="text-xs text-muted-foreground/80">
          <span className="font-medium">Como resolver:</span> {error.suggestion}
        </p>
      )}
    </div>
  );
}

/**
 * Exibição centralizada de erros.
 * - Erros estruturados (AppError) e técnicos viram o envelope amigável
 *   (título + descrição + como resolver).
 * - Strings já redigidas são exibidas como estão (sem duplicar contexto).
 * Use `showError(e)` no lugar de `toast.error(e.message)`.
 */
export function showError(input?: unknown, opts?: { fallback?: string }) {
  if (typeof input === "string" && input.length > 0) {
    toast.error(input);
    return;
  }
  const userError = toUserError(input, opts);
  toast.error(<ErrorToastView error={userError} />);
}

/** Estado de erro em linha (páginas, carregamentos, resultados). */
export function ErrorCard({
  error,
  retry,
  className,
}: {
  error: UserError;
  retry?: () => void;
  className?: string;
}) {
  return (
    <Alert variant="destructive" role="alert" className={cn("rounded-2xl", className)}>
      <TriangleAlert className="size-4" />
      <AlertTitle>{error.title}</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        {error.suggestion && (
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium">Como resolver:</span> {error.suggestion}
          </p>
        )}
        {retry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-lg"
            onClick={retry}
            type="button"
          >
            <RotateCcw className="size-3.5" /> Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** Atalho para `ErrorCard` a partir de qualquer erro cru. */
export function ErrorState({
  error,
  retry,
  className,
  fallback,
}: {
  error?: unknown;
  retry?: () => void;
  className?: string;
  fallback?: string;
}) {
  if (typeof error === "string" && error.length) {
    return (
      <Alert variant="destructive" role="alert" className={cn("rounded-2xl", className)}>
        <TriangleAlert className="size-4" />
        <AlertTitle>{error}</AlertTitle>
      </Alert>
    );
  }
  return <ErrorCard error={toUserError(error, { fallback })} retry={retry} className={className} />;
}

export { toast };
export { toUserError } from "./to-user-error";
export type { UserError, ErrorCode } from "./types";
