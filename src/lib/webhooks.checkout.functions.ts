import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CheckoutWebhookSchema = z.object({
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

export const checkoutWebhook = createServerFn({ method: "POST" })
  .validator((raw: unknown) => CheckoutWebhookSchema.parse(raw))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

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
      }
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
