import { createFileRoute } from "@tanstack/react-router";
import { StudentHome } from "@/components/student-home";

export const Route = createFileRoute("/app/student/")({
  head: () => ({ meta: [{ title: "Meus simulados | Lecto" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData({
      queryKey: ["student-simulados"],
      queryFn: () => Promise.resolve([]),
    });
  },
  component: StudentHome,
});
