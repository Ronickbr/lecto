import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCurrentUser, type AppRole } from "@/hooks/use-current-user";

/** Prefixo da rota -> papéis autorizados a vê-la. */
const AREA_ROLES: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/app/admin", roles: ["super_admin"] },
  // A página de resultado é compartilhada: a equipe da escola revisa a entrega do aluno.
  {
    prefix: "/app/student/resultado",
    roles: ["super_admin", "school_admin", "teacher", "student"],
  },
  { prefix: "/app/school", roles: ["super_admin", "school_admin", "teacher"] },
  { prefix: "/app/teacher", roles: ["super_admin", "school_admin", "teacher"] },
  { prefix: "/app/student", roles: ["super_admin", "student"] },
];

/**
 * Guarda de área por papel. O RLS já protege os dados; isto evita que um
 * usuário sem permissão veja telas vazias/quebradas de outra área.
 */
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data, isLoading } = useCurrentUser();
  const navigate = useNavigate();

  const area = AREA_ROLES.find((a) => pathname.startsWith(a.prefix));
  const allowed = !area || !data || data.roles.some((r) => area.roles.includes(r));

  useEffect(() => {
    if (!allowed) navigate({ to: "/app", replace: true });
  }, [allowed, navigate]);

  if (isLoading && area) {
    return (
      <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Carregando</span>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="grid min-h-[50vh] place-items-center px-4 text-center text-sm text-muted-foreground">
        Você não tem permissão para acessar esta área. Redirecionando…
      </div>
    );
  }

  return <>{children}</>;
}
