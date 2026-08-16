import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabase } from "../supabase/client.server";

export const checkoutWebhook = createServerFn({ method: "POST" })
  .validator(z.object({
    // Process Mercado Pago or InfinityPay webhook payload
    // Based on common webhook structures
    event_type: z.enum(["checkout.payment.completed", "payment.completed", "transaction.completed"]),
    data: z.object({
      id: z.string().min(1),
      type: z.enum(["credit_card", "debit_card", "account_money"]),
      provider: z.enum(["mercado_pago", "infinitypay", "other"]),
      status: z.literal("active" | "paid" | "refunded" | "canceled").default("paid"),
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
      })
    })
  }))
  .handler(async ({ data }) => {
    const supabase = await getSupabase();
    
    // Validate that payment was actually completed
    if (["paid", "active"].includes(data.status) && data.event_type === "checkout.payment.completed") {
      // Update order status in database
      const { error } = await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("transaction_id", data.transaction_id)
        .eq("user_id", data.metadata.user_id)
        .eq("school_id", data.metadata.school_id)
        .eq("status", "pending");
      
      if (error) {
        console.error("Error updating order status:", error);
      }
    }
    
    // Return success response - webhooks expect 2xx status codes
    return {
      status: 200,
      body: { 
        success: true,
        message: "Webhook processed successfully",
        paymentStatus: data.status
      }
    };
  });