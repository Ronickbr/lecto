import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageSchool } from "./authorization.server";
import { buildRubric, GenerateRubricInput, GenerateMissingRubricsInput } from "./rubrics.server";

/**
 * Gera (ou regenera) com IA a rubrica de uma questão aberta e salva em question_keys.
 * A leitura da questão passa pelo RLS do usuário: só quem enxerga a questão pode gerar.
 */
export const generateRubricFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => GenerateRubricInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: question, error } = await context.supabase
      .from("questions")
      .select("id, school_id, statement, q_type, points, pirls_process, text_id")
      .eq("id", data.questionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!question) throw new Error("Questão não encontrada");
    if (question.q_type !== "open") return { skipped: true as const, rubric: null };

    // Só editores da escola da questão (ou super_admin) podem gerar/salvar rubricas.
    await assertCanManageSchool(context.supabase, context.userId, question.school_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("question_keys")
      .select("correct_answer, rubric")
      .eq("question_id", question.id)
      .maybeSingle();

    if (!data.force && existing?.rubric?.trim()) {
      return { skipped: true as const, rubric: existing.rubric };
    }

    let textTitle: string | null = null;
    let textBody: string | null = null;
    if (question.text_id) {
      const { data: text } = await supabaseAdmin
        .from("texts")
        .select("title, body")
        .eq("id", question.text_id)
        .maybeSingle();
      textTitle = text?.title ?? null;
      textBody = text?.body ?? null;
    }

    const rubric = await buildRubric({
      statement: question.statement,
      points: question.points,
      pirls_process: question.pirls_process,
      correct_answer: existing?.correct_answer ?? null,
      textTitle,
      textBody,
    });

    const { error: upErr } = await supabaseAdmin.from("question_keys").upsert({
      question_id: question.id,
      school_id: question.school_id,
      correct_answer: existing?.correct_answer ?? null,
      rubric,
    });
    if (upErr) throw new Error(upErr.message);

    return { skipped: false as const, rubric };
  });

/**
 * Gera com IA as rubricas de todas as questões abertas da escola que ainda não têm rubrica.
 */
export const generateMissingRubricsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => GenerateMissingRubricsInput.parse(raw))
  .handler(async ({ data, context }) => {
    // Só editores da escola (ou super_admin) podem gerar rubricas em lote.
    await assertCanManageSchool(context.supabase, context.userId, data.schoolId);

    const { data: questions, error } = await context.supabase
      .from("questions")
      .select("id, school_id, statement, points, pirls_process, text_id")
      .eq("school_id", data.schoolId)
      .eq("q_type", "open");
    if (error) throw new Error(error.message);
    if (!questions?.length) return { generated: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = questions.map((q) => q.id);
    const { data: keys } = await supabaseAdmin
      .from("question_keys")
      .select("question_id, correct_answer, rubric")
      .in("question_id", ids);
    const keyById = new Map((keys ?? []).map((k) => [k.question_id, k]));

    const pending = questions.filter((q) => !keyById.get(q.id)?.rubric?.trim()).slice(0, 30);
    if (!pending.length) return { generated: 0 };

    // Busca todos os textos de uma vez (antes era uma consulta por questão).
    const textIds = Array.from(new Set(pending.map((q) => q.text_id).filter(Boolean) as string[]));
    const textById = new Map<string, { title: string; body: string }>();
    if (textIds.length) {
      const { data: texts } = await supabaseAdmin
        .from("texts")
        .select("id, title, body")
        .in("id", textIds);
      (texts ?? []).forEach((t) => textById.set(t.id, { title: t.title, body: t.body }));
    }

    let generated = 0;
    const runOne = async (q: (typeof pending)[number]) => {
      const text = q.text_id ? textById.get(q.text_id) : undefined;
      const rubric = await buildRubric({
        statement: q.statement,
        points: q.points,
        pirls_process: q.pirls_process,
        correct_answer: keyById.get(q.id)?.correct_answer ?? null,
        textTitle: text?.title ?? null,
        textBody: text?.body ?? null,
      });
      const { error: upErr } = await supabaseAdmin.from("question_keys").upsert({
        question_id: q.id,
        school_id: q.school_id,
        correct_answer: keyById.get(q.id)?.correct_answer ?? null,
        rubric,
      });
      if (!upErr) generated += 1;
    };

    // Lotes de 3 para não estourar limites do gateway de IA.
    const CHUNK = 3;
    for (let i = 0; i < pending.length; i += CHUNK) {
      await Promise.all(pending.slice(i, i + CHUNK).map(runOne));
    }

    return { generated };
  });
