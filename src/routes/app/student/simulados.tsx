import { createFileRoute } from "@tanstack/react-router";
import { StudentHome } from "@/components/student-home";

export const Route = createFileRoute("/app/student/simulados")({
  head: () => ({ meta: [{ title: "Meus simulados | Lecto" }] }),
  component: StudentHome,
});
