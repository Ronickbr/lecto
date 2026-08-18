import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentUser } from "@/hooks/use-current-user";
import { provisionSchoolAdminFn } from "@/lib/signup.functions";
import { Loader2 } from "lucide-react";
import { ErrorState, toast } from "@/lib/errors/feedback";

export const Route = createFileRoute("/app/")({
  component: RoleRedirect,
});

function RoleRedirect() {
  const { data, isLoading, isFetching, isError, error, refetch } = useCurrentUser();
  const navigate = useNavigate();
  const provisionSchoolAdmin = useServerFn(provisionSchoolAdminFn);
  const qc = useQueryClient();
  const provisioningRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    if (data.primaryRole === "super_admin") navigate({ to: "/app/admin", replace: true });
    else if (data.primaryRole === "school_admin") navigate({ to: "/app/school", replace: true });
    else if (data.primaryRole === "teacher") navigate({ to: "/app/teacher", replace: true });
    else if (data.primaryRole === "student") navigate({ to: "/app/student", replace: true });
    else if (!provisioningRef.current) {
      // Conta sem papel (ex.: signup com confirmação de e-mail, que não
      // retorna sessão) — provisiona como school_admin em trial. Idempotente:
      // se o papel já existir no servidor, vira no-op.
      provisioningRef.current = true;
      provisionSchoolAdmin()
        .then(() => qc.invalidateQueries({ queryKey: ["current-user"] }))
        .catch((err) => {
          console.error("Falha ao provisionar school_admin", err);
          toast.error("Não foi possível configurar sua conta como administrador de escola.");
        })
        .finally(() => {
          provisioningRef.current = false;
        });
    }
  }, [data, navigate, provisionSchoolAdmin, qc]);

  // Só afirmamos "sem papel" quando a consulta terminou COM dados de usuário
  // e a tentativa de provisionamento já resolveu.
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
