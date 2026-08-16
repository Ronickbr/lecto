import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

export type PaymentProvider = "mercado_pago" | "infinitypay";

export interface ProcessPaymentWebhookInput {
  provider: PaymentProvider;
  eventId: string;
  transactionId: string;
  externalReference: string;
  paid: boolean;
  rawPayload: Json;
}

/**
 * Registra o evento no ledger (idempotência) e ativa a assinatura da escola
 * quando um pagamento é confirmado.
 *
 * Duplicatas (mesmo `eventId`) são ignoradas. O `external_reference` aponta
 * para a linha correspondente na tabela `checkouts`, que guarda school_id e
 * plan_id usados para ativar `subscriptions` e `schools`.
 */
export async function processPaymentWebhook(input: ProcessPaymentWebhookInput): Promise<{
  status: number;
  body: { success: boolean; message: string; alreadyProcessed?: boolean };
}> {
  const supabase = supabaseAdmin;

  // Idempotência: provê de re-tentativas não reprocessam o mesmo evento.
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("id", input.eventId)
    .maybeSingle();
  if (existing) {
    return {
      status: 200,
      body: { success: true, message: "Evento já processado", alreadyProcessed: true },
    };
  }

  // Localiza o checkout original pelo reference do provedor.
  const { data: checkout, error: checkoutErr } = await supabase
    .from("checkouts")
    .select("id, school_id, plan_id, provider, amount_cents, status")
    .eq("external_reference", input.externalReference)
    .maybeSingle();

  if (checkoutErr || !checkout) {
    const message = `Checkout não encontrado para reference ${input.externalReference}`;
    console.error("[webhook]", message, checkoutErr ?? "");
    return { status: 400, body: { success: false, message } };
  }

  if (checkout.provider !== input.provider) {
    const message = `Provider ${input.provider} não corresponde ao checkout (${checkout.provider})`;
    console.error("[webhook]", message);
    return { status: 400, body: { success: false, message } };
  }

  if (checkout.status === "paid") {
    return {
      status: 200,
      body: { success: true, message: "Assinatura já ativada", alreadyProcessed: true },
    };
  }

  if (input.paid) {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert da assinatura (uma por escola).
    const { error: subErr } = await supabase.from("subscriptions").upsert(
      {
        school_id: checkout.school_id,
        plan_id: checkout.plan_id,
        started_at: now,
        expires_at: expiresAt,
        status: "active",
      },
      { onConflict: "school_id" },
    );

    // Sincroniza o painel admin (fonte de verdade do status exibido).
    const { error: schoolErr } = await supabase
      .from("schools")
      .update({
        subscription_status: "active",
        plan_id: checkout.plan_id,
        subscription_expires_at: expiresAt,
        updated_at: now,
      })
      .eq("id", checkout.school_id);

    if (subErr || schoolErr) {
      console.error("[webhook] Erro ao ativar assinatura:", subErr ?? schoolErr);
      return { status: 500, body: { success: false, message: "Falha ao ativar assinatura" } };
    }

    await supabase.from("checkouts").update({ status: "paid", paid_at: now }).eq("id", checkout.id);
  } else {
    await supabase.from("checkouts").update({ status: "pending" }).eq("id", checkout.id);
  }

  // Ledger final — registra como processado para as próximas tentativas serem no-op.
  const { error: ledgerErr } = await supabase.from("webhook_events").insert({
    id: input.eventId,
    event_type: "checkout.payment.completed",
    transaction_id: input.transactionId,
    provider: input.provider,
    status: "processed",
    payload: input.rawPayload,
  });
  if (ledgerErr) {
    console.error("[webhook] Erro ao registrar evento no ledger:", ledgerErr);
  }

  return {
    status: 200,
    body: {
      success: true,
      message: input.paid ? "Pagamento processado com sucesso" : "Pagamento não confirmado",
    },
  };
}
