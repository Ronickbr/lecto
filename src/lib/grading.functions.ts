import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject } from "ai";
import { createAiProvider, getAiModel } from "./ai-gateway.server";
import { GradeInput, OpenGrade, type ProcessKey } from "./grading.server";

// Rate limit simples em memória por usuário: evita custo de IA abusivo
// (ex.: aluno acionando correção repetidamente em várias tentativas).
const gradeBuckets = new Map<string, number[]>();

function assertNotRateLimited(userId: string, maxCalls = 8, windowMs = 60_000): void {
  const now = Date.now();
  const timestamps = (gradeBuckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxCalls) {
    throw new Error("Muitas correções em sequência. Aguarde um pouco e tente novamente.");
  }
  timestamps.push(now);
  gradeBuckets.set(userId, timestamps);
}

/**
 * Grades an attempt: multiple-choice deterministically, open answers with AI + rubric.
 * Caller must be able to read the attempt through RLS (student owner, teacher or school admin).
 */
export const gradeAttemptFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => GradeInput.parse(input))
  .handler(async ({ data, context }) => {
    // Rate limit por usuário antes de qualquer chamada de IA.
    assertNotRateLimited(context.userId);

    // Authorization: RLS decides whether this user may see the attempt.
    const { data: visible, error: visibleError } = await context.supabase
      .from("simulado_attempts")
      .select("id, simulado_id, submitted_at, graded_at")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (visibleError) throw new Error(visibleError.message);
    if (!visible) throw new Error("Tentativa não encontrada");
    if (!visible.submitted_at) throw new Error("Tentativa ainda não foi enviada");
    if (visible.graded_at) return { alreadyGraded: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: answers } = await supabaseAdmin
      .from("simulado_answers")
      .select("id, question_id, answer")
      .eq("attempt_id", data.attemptId);

    const questionIds = (answers ?? []).map((a) => a.question_id).filter(Boolean) as string[];

    const idFilter = questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"];

    const [{ data: questions }, { data: keys }] = await Promise.all([
      supabaseAdmin
        .from("questions")
        .select("id, statement, q_type, options, points, pirls_process")
        .in("id", idFilter),
      supabaseAdmin
        .from("question_keys")
        .select("question_id, correct_answer, rubric")
        .in("question_id", idFilter),
    ]);

    const keyById = new Map((keys ?? []).map((k) => [k.question_id, k]));
    const qById = new Map(
      (questions ?? []).map((q) => [
        q.id,
        {
          ...q,
          correct_answer: keyById.get(q.id)?.correct_answer ?? null,
          rubric: keyById.get(q.id)?.rubric ?? null,
        },
      ]),
    );

    let provider: ReturnType<typeof createAiProvider> | null = null;
    try {
      provider = createAiProvider();
    } catch {
      // Sem chave/base configurada: segue sem IA, usando fallbacks determinísticos.
    }
    const model = provider ? provider(getAiModel()) : null;

    const processTotals: Record<string, { earned: number; max: number }> = {};
    let total = 0;
    let max = 0;

    for (const a of answers ?? []) {
      const q = a.question_id ? qById.get(a.question_id) : undefined;
      if (!q) continue;
      const points = q.points ?? 1;
      let score = 0;
      let feedback: string | null = null;
      let isCorrect: boolean | null = null;

      if (q.q_type === "multiple_choice") {
        isCorrect =
          !!a.answer &&
          String(a.answer).trim().toLowerCase() ===
            String(q.correct_answer ?? "")
              .trim()
              .toLowerCase();
        score = isCorrect ? points : 0;
        feedback = isCorrect
          ? "Resposta correta."
          : `Resposta incorreta. Gabarito: ${q.correct_answer ?? "—"}.`;
      } else if ((a.answer ?? "").trim().length === 0) {
        score = 0;
        feedback = "Sem resposta registrada.";
      } else if (model) {
        try {
          const { object } = await generateObject({
            model,
            schema: OpenGrade,
            prompt: [
              "Você é um corretor especialista em compreensão leitora (matriz PIRLS).",
              `Processo avaliado: ${q.pirls_process}.`,
              `Pergunta: ${q.statement}`,
              `Rubrica: ${q.rubric ?? "Avalie precisão, uso de evidências do texto e clareza."}`,
              `Pontuação máxima: ${points}.`,
              `Resposta do aluno: ${a.answer}`,
              `Retorne score entre 0 e ${points} e um feedback curto (máx. 2 frases) em português, com justificativa.`,
            ].join("\n"),
          });
          score = Math.max(0, Math.min(points, Number(object.score) || 0));
          feedback = object.feedback;
        } catch {
          score = 0;
          feedback = "Não foi possível corrigir automaticamente. Aguarde revisão do professor.";
        }
      } else {
        feedback = "Correção automática indisponível.";
      }

      const p = q.pirls_process as ProcessKey;
      processTotals[p] = processTotals[p] ?? { earned: 0, max: 0 };
      processTotals[p].earned += score;
      processTotals[p].max += points;
      total += score;
      max += points;

      const { error: ansErr } = await supabaseAdmin
        .from("simulado_answers")
        .update({
          score,
          max_points: points,
          is_correct: isCorrect,
          ai_feedback: feedback,
          graded_at: new Date().toISOString(),
        })
        .eq("id", a.id);
      if (ansErr) throw new Error(`Falha ao salvar a correção de uma questão: ${ansErr.message}`);
    }

    const processScores: Record<string, number> = {};
    for (const [p, v] of Object.entries(processTotals)) {
      processScores[p] = v.max > 0 ? Math.round((v.earned / v.max) * 100) : 0;
    }

    const { error: attemptErr } = await supabaseAdmin
      .from("simulado_attempts")
      .update({
        total_score: total,
        max_score: max,
        graded_at: new Date().toISOString(),
        process_scores: processScores,
      })
      .eq("id", data.attemptId);
    if (attemptErr) throw new Error(`Falha ao consolidar a nota: ${attemptErr.message}`);

    return { total, max, processScores };
  });
