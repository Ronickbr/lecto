import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Loader2 } from "lucide-react";
import { ErrorState } from "@/lib/errors/feedback";

export const Route = createFileRoute("/app/")({
  component: RoleRedirect,
});

function RoleRedirect() {
  const { data, isLoading, isFetching, isError, error, refetch } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!data) return;
    if (data.primaryRole === "super_admin") navigate({ to: "/app/admin", replace: true });
    else if (data.primaryRole === "school_admin") navigate({ to: "/app/school", replace: true });
    else if (data.primaryRole === "teacher") navigate({ to: "/app/teacher", replace: true });
    else if (data.primaryRole === "student") navigate({ to: "/app/student", replace: true });
  }, [data, navigate]);

  // Só afirmamos "sem papel" quando a consulta terminou COM dados de usuário.
  const noRole = !isLoading && !isFetching && !isError && data !== null && !data?.primaryRole;

  return (
    <div className="mx-auto grid min-h-[50vh] max-w-md place-items-center px-4">
      {noRole ? (
        <p className="text-center text-muted-foreground">Sem papel atribuído. Contate o suporte.</p>
      ) : isError ? (
        <ErrorState error={error} retry={() => refetch()} className="w-full" />
      ) : (
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
