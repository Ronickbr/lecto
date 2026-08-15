import { z } from "zod";

export const PIRLS_PROCESSES = [
  "locate_information",
  "straightforward_inference",
  "interpret_integrate",
  "evaluate_critique",
] as const;

export const GeneratedQuestion = z.object({
  statement: z.string(),
  q_type: z.enum(["multiple_choice", "open"]),
  options: z.array(z.string()),
  correct_answer: z.string(),
  pirls_process: z.enum(PIRLS_PROCESSES),
  explanation: z.string(),
  rubric: z.string(),
});

export const GeneratedPayload = z.object({
  title: z.string(),
  body: z.string(),
  category: z.enum(["literary", "informational", "mixed"]),
  level: z.enum(["easy", "medium", "hard"]),
  questions: z.array(GeneratedQuestion),
});

export const GenerateInput = z.object({
  topic: z.string().min(3),
  level: z.enum(["easy", "medium", "hard"]).default("medium"),
  category: z.enum(["literary", "informational", "mixed"]).default("literary"),
  questionCount: z.number().int().min(4).max(16).default(8),
  simuladoId: z.string().uuid().optional(),
});

export const ReorderInput = z.object({
  type: z.enum(["page", "block"]),
  ids: z.array(z.string().uuid()).max(500),
});
