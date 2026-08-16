import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Loader2 } from "lucide-react";

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
    <div className="grid min-h-[50vh] place-items-center text-center text-muted-foreground">
      {noRole ? (
        "Sem papel atribuído. Contate o suporte."
      ) : isError ? (
        <div className="flex flex-col items-center gap-3">
          <p>Não foi possível carregar seu perfil.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:opacity-90"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <Loader2 className="size-6 animate-spin" />
      )}
    </div>
  );
}
