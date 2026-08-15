import { generateText } from "ai";
import { z } from "zod";
import { createAiProvider, getAiModel } from "./ai-gateway.server";
import { PROCESS_LABEL } from "./pirls";

export const GenerateRubricInput = z.object({
  questionId: z.string().uuid(),
  force: z.boolean().optional(),
});

export const GenerateMissingRubricsInput = z.object({ schoolId: z.string().uuid() });

export const FALLBACK_RUBRIC =
  "Avalie precisão da resposta, uso de evidências do texto e clareza. Pontuação total quando a resposta responde ao que foi pedido e apresenta evidência do texto; pontuação parcial quando responde sem justificar; zero quando não há relação com o texto.";

export async function buildRubric(question: {
  statement: string;
  points: number;
  pirls_process: string;
  correct_answer: string | null;
  textTitle: string | null;
  textBody: string | null;
}) {
  let gateway: ReturnType<typeof createAiProvider> | null = null;
  try {
    gateway = createAiProvider();
  } catch {
    return FALLBACK_RUBRIC;
  }

  const processLabel =
    (PROCESS_LABEL as Record<string, string>)[question.pirls_process] ?? question.pirls_process;

  const excerpt = (question.textBody ?? "").slice(0, 4000);

  try {
    const { text } = await generateText({
      model: gateway(getAiModel()),
      prompt: [
        "Você é especialista em avaliação de compreensão leitora no referencial PIRLS/ePIRLS.",
        "Escreva uma RUBRICA de correção em português do Brasil para a questão aberta abaixo.",
        "Formato: um parágrafo curto com os critérios e, em seguida, os níveis de pontuação",
        `distribuídos entre 0 e ${question.points} ponto(s), cada nível em uma linha começando por "- ".`,
        "Não repita o enunciado, não use markdown de títulos e não escreva nada além da rubrica.",
        "",
        `Processo PIRLS: ${processLabel}`,
        `Pontuação máxima: ${question.points}`,
        `Enunciado: ${question.statement}`,
        question.correct_answer ? `Resposta modelo: ${question.correct_answer}` : "",
        question.textTitle ? `Texto base: ${question.textTitle}` : "",
        excerpt ? `Trecho do texto:\n${excerpt}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    const rubric = text.trim();
    return rubric.length > 20 ? rubric : FALLBACK_RUBRIC;
  } catch {
    return FALLBACK_RUBRIC;
  }
}
