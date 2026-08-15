import { z } from "zod";

export const GradeInput = z.object({ attemptId: z.string().uuid() });

export const OpenGrade = z.object({
  score: z.number(),
  feedback: z.string(),
});

export type ProcessKey =
  "locate_information" | "straightforward_inference" | "interpret_integrate" | "evaluate_critique";
