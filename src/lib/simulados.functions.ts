import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createAiProvider, getAiModel } from "./ai-gateway.server";
import { assertCanManageSchool, resolveSchoolIdForGeneration } from "./manage.server";
import {
  PIRLS_PROCESSES,
  GeneratedPayload,
  GenerateInput,
  ReorderInput,
  SaveGeneratedInput,
} from "./simulados.server";

type GenerationContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

/** Persiste o payload gerado pela IA (texto + questões + gabarito) como página do simulado. */
async function persistGeneratedPayload(
  context: GenerationContext,
  schoolId: string,
  object: z.infer<typeof GeneratedPayload>,
  simuladoId: string | undefined,
) {
  // Insert text
  const { data: textRow, error: textErr } = await context.supabase
    .from("texts")
    .insert({
      school_id: schoolId,
      title: object.title,
      body: object.body,
      category: object.category,
      level: object.level,
      source: "AI",
      word_count: object.body.split(/\s+/).filter(Boolean).length,
      created_by: context.userId,
    })
    .select()
    .single();
  if (textErr || !textRow) throw new Error(textErr?.message ?? "Falha ao salvar texto");

  // Insert questions
  const questionsPayload = object.questions.map((q) => ({
    school_id: schoolId,
    text_id: textRow.id,
    statement: q.statement,
    q_type: q.q_type,
    options: q.options,
    pirls_process: q.pirls_process,
    explanation: q.explanation,
    created_by: context.userId,
    points: 1,
  }));
  const { data: insertedQs, error: qErr } = await context.supabase
    .from("questions")
    .insert(questionsPayload)
    .select();
  if (qErr) throw new Error(qErr.message);

  // Answer keys live in a separate, editor-only table so students can never read them.
  if (insertedQs?.length) {
    const { error: keyErr } = await context.supabase.from("question_keys").insert(
      insertedQs.map((row, i) => ({
        question_id: row.id,
        school_id: schoolId,
        correct_answer: object.questions[i]?.correct_answer ?? null,
        rubric: object.questions[i]?.rubric ?? null,
      })),
    );
    if (keyErr) throw new Error(keyErr.message);
  }

  // If simuladoId provided, create a new page + blocks
  if (simuladoId) {
    const { data: existingPages } = await context.supabase
      .from("simulado_pages")
      .select("position")
      .eq("simulado_id", simuladoId)
      .order("position", { ascending: false })
      .limit(1);
    const nextPos = (existingPages?.[0]?.position ?? -1) + 1;

    const { data: page, error: pageErr } = await context.supabase
      .from("simulado_pages")
      .insert({
        simulado_id: simuladoId,
        position: nextPos,
        title: object.title,
        instructions: `Leia o texto abaixo com atenção e responda às ${insertedQs?.length ?? 0} questões.`,
        text_id: textRow.id,
      })
      .select()
      .single();
    if (pageErr || !page) throw new Error(pageErr?.message ?? "Falha ao criar página");

    const blocks = (insertedQs ?? []).map((q, i) => ({
      page_id: page.id,
      position: i,
      b_type: "question" as const,
      question_id: q.id,
    }));
    if (blocks.length > 0) {
      const { error: bErr } = await context.supabase.from("simulado_blocks").insert(blocks);
      if (bErr) throw new Error(bErr.message);
    }
    return {
      textId: textRow.id,
      questionIds: (insertedQs ?? []).map((q) => q.id),
      pageId: page.id,
    };
  }

  return { textId: textRow.id, questionIds: (insertedQs ?? []).map((q) => q.id) };
}

/** Generate a balanced PIRLS text + questions and (optionally) insert as a new page in a simulado. */
export const generateTextAndQuestionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    // Só editores da escola podem gerar conteúdo (alunos são rejeitados antes da IA).
    const schoolId = await resolveSchoolIdForGeneration(context.supabase, context.userId);

    // Se o destino é um simulado existente, exige ser editor da escola dona dele.
    if (data.simuladoId) {
      const { data: target } = await context.supabase
        .from("simulados")
        .select("school_id")
        .eq("id", data.simuladoId)
        .maybeSingle();
      if (!target) throw new Error("Simulado não encontrado");
      await assertCanManageSchool(context.supabase, context.userId, target.school_id);
    }

    const provider = createAiProvider();

    const model = provider(getAiModel());

    const perProcess = Math.max(1, Math.floor(data.questionCount / 4));
    const distributionText = PIRLS_PROCESSES.map((p) => `${perProcess}× ${p}`).join(", ");

    const { object } = await generateObject({
      model,
      schema: GeneratedPayload,
      prompt: `Você é especialista em avaliação PIRLS. Gere um texto de leitura em português brasileiro sobre o tema: "${data.topic}".

Requisitos:
- Categoria: ${data.category} (literary=narrativo/literário, informational=informativo, mixed=híbrido).
- Nível de dificuldade: ${data.level}.
- Texto de 250 a 500 palavras, adequado a estudantes do ensino fundamental.
- Gere exatamente ${data.questionCount} questões distribuídas de forma balanceada entre os 4 processos PIRLS: ${distributionText}.
- Cada questão deve indicar seu processo PIRLS em pirls_process.
- Misture questões de múltipla escolha (q_type="multiple_choice", com 4 opções e correct_answer contendo a opção correta LITERAL) e abertas (q_type="open", options=[], correct_answer com resposta modelo).
- Preencha rubric com critérios de correção para questões abertas (para múltipla escolha pode ser breve).
- Preencha explanation com justificativa pedagógica curta.
Retorne em JSON.`,
    });

    // Modo preview: devolve o payload para revisão sem tocar no banco.
    if (data.previewOnly) {
      return { preview: object };
    }

    const result = await persistGeneratedPayload(context, schoolId, object, data.simuladoId);
    return result;
  });

/** Persiste um payload previamente gerado (fluxo de preview/revisão) como página do simulado. */
export const saveGeneratedPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SaveGeneratedInput.parse(input))
  .handler(async ({ data, context }) => {
    const schoolId = await resolveSchoolIdForGeneration(context.supabase, context.userId);

    if (data.simuladoId) {
      const { data: target } = await context.supabase
        .from("simulados")
        .select("school_id")
        .eq("id", data.simuladoId)
        .maybeSingle();
      if (!target) throw new Error("Simulado não encontrado");
      await assertCanManageSchool(context.supabase, context.userId, target.school_id);
    }

    return persistGeneratedPayload(context, schoolId, data.payload, data.simuladoId);
  });

/**
 * Reorder pages within a simulado or blocks within a page.
 * A autorização é do RLS (apenas editores da escola dona do simulado);
 * aqui garantimos que uma falha parcial não passe despercebida.
 */
export const reorderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ReorderInput.parse(input))
  .handler(async ({ data, context }) => {
    const table = data.type === "page" ? "simulado_pages" : "simulado_blocks";
    const results = await Promise.all(
      data.ids.map((id, i) =>
        context.supabase.from(table).update({ position: i }).eq("id", id).select("id"),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(`Falha ao reordenar: ${failed.error.message}`);
    // Sem linhas afetadas = RLS bloqueou (usuário não é editor desta escola).
    if (results.some((r) => (r.data?.length ?? 0) === 0)) {
      throw new Error("Sem permissão para reordenar este simulado");
    }
    return { ok: true };
  });
