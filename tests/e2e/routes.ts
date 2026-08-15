/** Routes audited by the responsive e2e suite. */

export const PUBLIC_ROUTES = [
  { path: "/", label: "Landing" },
  { path: "/auth", label: "Login staff" },
  { path: "/auth/student", label: "Login aluno" },
] as const;

/** Requires an authenticated session (any /app/* route). */
export const APP_ROUTES = [
  { path: "/app", label: "Redirecionamento por papel" },
  { path: "/app/admin", label: "Admin — visão geral" },
  { path: "/app/admin/schools", label: "Admin — escolas" },
  { path: "/app/admin/plans", label: "Admin — planos" },
  { path: "/app/school", label: "Escola — visão geral" },
  { path: "/app/school/classes", label: "Escola — turmas" },
  { path: "/app/school/students", label: "Escola — alunos" },
  { path: "/app/school/teachers", label: "Escola — professores" },
  { path: "/app/school/texts", label: "Escola — banco de textos" },
  { path: "/app/school/simulados", label: "Escola — simulados" },
  { path: "/app/teacher", label: "Professor — painel" },
  { path: "/app/teacher/resultados", label: "Professor — resultados" },
  { path: "/app/teacher/tentativas", label: "Professor — tentativas" },
  { path: "/app/teacher/rubricas", label: "Professor — rubricas" },
  { path: "/app/student", label: "Aluno — painel" },
  { path: "/app/student/simulados", label: "Aluno — simulados" },
  { path: "/app/student/progresso", label: "Aluno — progresso" },
] as const;
