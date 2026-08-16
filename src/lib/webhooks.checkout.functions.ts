import { createServerFn } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const CheckoutWebhookSchema = z.object({
  // Optional HMAC-SHA256 signature over the raw request body, hex-encoded.
  // Providers that cannot sign raw bodies should instead send the signature in
  // a separate header; that path requires a raw HTTP route, not a serverFn.
  signature: z.string().optional(),
  // Process Mercado Pago or InfinityPay webhook payload
  // Based on common webhook structures
  event_type: z.enum(["checkout.payment.completed", "payment.completed", "transaction.completed"]),
  data: z.object({
    id: z.string().min(1),
    type: z.enum(["credit_card", "debit_card", "account_money"]),
    provider: z.enum(["mercado_pago", "infinitypay", "other"]),
    status: z.enum(["active", "paid", "refunded", "canceled"]).default("paid"),
    amount: z.number().positive(),
    currency: z.literal("BRL").default("BRL"),
    payer_email: z.string().email(),
    transaction_id: z.string().min(1),
    metadata: z.object({
      user_id: z.string(),
      school_id: z.string(),
      classroom_id: z.string().nullish(),
      purchase_type: z.enum(["single", "subscription", "bundle"]).default("single"),
      product_id: z.string(),
    }),
  }),
});

// Webhook events arrive with no session, so they must be authenticated by a
// shared secret. Set WEBHOOK_SECRET (HMAC-SHA256) in the server environment and
// configure the payment provider to sign the raw request body with it.
function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const checkoutWebhook = createServerFn({ method: "POST" })
  .validator((raw: unknown) => CheckoutWebhookSchema.parse(raw))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    const rawBody = JSON.stringify(data);
    const signature = data.signature ?? null;

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error("[webhook] Assinatura inválida ou WEBHOOK_SECRET ausente");
      return {
        status: 401,
        body: { success: false, message: "Invalid signature" },
      };
    }

    // Idempotency: ignore deliveries we already processed for this transaction.
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("id", data.data.id)
      .maybeSingle();
    if (existing) {
      return {
        status: 200,
        body: { success: true, message: "Already processed", paymentStatus: data.data.status },
      };
    }

    const eventId = data.data.id;

    // Validate that payment was actually completed
    if (
      ["paid", "active"].includes(data.data.status) &&
      data.event_type === "checkout.payment.completed"
    ) {
      // Update subscription status in database
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "active" })
        .eq("school_id", data.data.metadata.school_id);

      if (error) {
        console.error("Error updating subscription status:", error);
        return { status: 500, body: { success: false, message: "Update failed" } };
      }
    }

    // Record the processed event to make retries idempotent.
    const { error: ledgerErr } = await supabase.from("webhook_events").insert({
      id: eventId,
      event_type: data.event_type,
      transaction_id: data.data.transaction_id,
      provider: data.data.provider,
      status: "processed",
      payload: data as unknown as Json,
    });
    if (ledgerErr) {
      console.error("[webhook] Erro ao registrar evento:", ledgerErr);
    }

    // Return success response - webhooks expect 2xx status codes
    return {
      status: 200,
      body: {
        success: true,
        message: "Webhook processed successfully",
        paymentStatus: data.data.status,
      },
    };
  });
