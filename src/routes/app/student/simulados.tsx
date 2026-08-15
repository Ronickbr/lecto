import { createFileRoute } from "@tanstack/react-router";
import StudentHome from "./index";

export const Route = createFileRoute("/app/student/simulados")({
  head: () => ({ meta: [{ title: "Meus simulados | Lecto" }] }),
  component: StudentHome,
});
