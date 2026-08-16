import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface IntegrationTestResult {
  service: string;
  ok: boolean;
  status: number;
  message: string;
}

/**
 * Testa a conexão real de cada integração configurada no servidor
 * (Mercado Pago, InfinityPay, Resend e IA). Apenas super admin.
 */
export const testIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        services: z.array(z.enum(["mercadopago", "infinitypay", "resend"])).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }): Promise<IntegrationTestResult[]> => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Apenas o administrador geral pode testar integrações");

    const requested = data.services ?? (["mercadopago", "infinitypay", "resend"] as const);

    const results: IntegrationTestResult[] = [];

    for (const service of requested) {
      if (service === "mercadopago") {
        try {
          const { testMercadoPagoConnection } = await import("@/lib/mercadopago.server");
          const res = await testMercadoPagoConnection();
          results.push({ service, ...res });
        } catch (error) {
          results.push({
            service,
            ok: false,
            status: 0,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (service === "infinitypay") {
        try {
          const { testInfinityPayConnection } = await import("@/lib/infinitypay.server");
          const res = await testInfinityPayConnection();
          results.push({ service, ...res });
        } catch (error) {
          results.push({
            service,
            ok: false,
            status: 0,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (service === "resend") {
        try {
          const { testResendConnection } = await import("@/lib/resend.server");
          const res = await testResendConnection();
          results.push({ service, ...res });
        } catch (error) {
          results.push({
            service,
            ok: false,
            status: 0,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return results;
  });

export interface CreateCheckoutResult {
  checkoutId: string;
  checkoutUrl: string | null;
  externalReference: string;
}

/**
 * Cria um link/checkout de pagamento para uma escola em um provedor.
 * Persiste o pedido na tabela `checkouts` (auditoria + mapeamento de webhook).
 */
export const createCheckoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        provider: z.enum(["mercado_pago", "infinitypay"]),
        schoolId: z.string().min(1),
        planId: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }): Promise<CreateCheckoutResult> => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Apenas o administrador geral pode criar checkouts");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan, error: planErr } = await supabaseAdmin
      .from("plans")
      .select("id, name, price_cents")
      .eq("id", data.planId)
      .single();
    if (planErr || !plan) throw new Error("Plano não encontrado");

    const externalReference = `${data.provider}_${data.schoolId.slice(0, 8)}_${Date.now()}`;

    const { data: checkout, error: checkoutErr } = await supabaseAdmin
      .from("checkouts")
      .insert({
        school_id: data.schoolId,
        plan_id: data.planId,
        provider: data.provider,
        external_reference: externalReference,
        amount_cents: plan.price_cents,
        status: "pending",
      })
      .select("id")
      .single();
    if (checkoutErr || !checkout) throw new Error("Falha ao registrar pedido de pagamento");

    const origin =
      process.env.APP_URL ?? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "lecto.app"}`;
    const successUrl = `${origin}/checkout/sucesso?ref=${externalReference}`;

    let checkoutUrl: string | null = null;

    if (data.provider === "mercado_pago") {
      const { createCheckoutPreference } = await import("@/lib/mercadopago.server");
      const preference = await createCheckoutPreference({
        items: [
          {
            title: plan.name,
            quantity: 1,
            unit_price: plan.price_cents / 100,
            id: plan.id,
          },
        ],
        externalReference,
        notificationUrl: `${origin}/api/webhooks/mercadopago`,
        backUrls: {
          success: successUrl,
          failure: `${origin}/checkout/sucesso?status=failure&ref=${externalReference}`,
          pending: `${origin}/checkout/sucesso?status=pending&ref=${externalReference}`,
        },
      });
      checkoutUrl = preference.init_point;
    }

    if (data.provider === "infinitypay") {
      const { createInfinityPayLink, getInfinityPayHandle } =
        await import("@/lib/infinitypay.server");
      const link = await createInfinityPayLink({
        handle: getInfinityPayHandle(),
        items: [{ quantity: 1, price: plan.price_cents, description: plan.name }],
        orderNsu: externalReference,
        redirectUrl: successUrl,
        webhookUrl: `${origin}/api/webhooks/infinitypay`,
      });
      checkoutUrl = (link.checkout_url ?? link.link ?? null) as string | null;
    }

    if (checkoutUrl) {
      await supabaseAdmin
        .from("checkouts")
        .update({ checkout_url: checkoutUrl })
        .eq("id", checkout.id);
    }

    return { checkoutId: checkout.id, checkoutUrl, externalReference };
  });
