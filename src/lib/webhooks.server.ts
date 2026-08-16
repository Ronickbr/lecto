import type { Json } from "@/integrations/supabase/types";
import { processPaymentWebhook } from "./payment-processing.server";
import { getMercadoPagoWebhookSecret, verifyMercadoPagoSignature } from "./mercadopago.server";

export const WEBHOOK_ROUTES = ["/api/webhooks/mercadopago", "/api/webhooks/infinitypay"] as const;

export type WebhookRoute = (typeof WEBHOOK_ROUTES)[number];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Handler de webhooks HTTP puros (fora de serverFn) — necessário porque o
 * Mercado Pago envia a assinatura no header `x-signature`, e o InfinityPay
 * envia `data.id`/`order_nsu` na query string/corpo com contratos próprios.
 *
 * Retorna `null` quando o path não corresponde a uma rota de webhook; nesse
 * caso o SSR do TanStack Start segue o fluxo normal.
 */
export async function handleWebhookRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!WEBHOOK_ROUTES.includes(path as WebhookRoute)) return null;

  if (request.method !== "POST") {
    return jsonResponse(405, { success: false, message: "Method not allowed" });
  }

  if (path === "/api/webhooks/mercadopago") {
    return handleMercadoPagoWebhook(request, url);
  }
  if (path === "/api/webhooks/infinitypay") {
    return handleInfinityPayWebhook(request);
  }
  return null;
}

// --- Mercado Pago ------------------------------------------------------------

async function handleMercadoPagoWebhook(request: Request, url: URL): Promise<Response> {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  const dataId = url.searchParams.get("data.id");

  // A assinatura cobre o data.id da query string + x-request-id + timestamp.
  if (!dataId || !signatureHeader) {
    return jsonResponse(400, { success: false, message: "Assinatura ou data.id ausentes" });
  }

  let secret: string;
  try {
    secret = getMercadoPagoWebhookSecret();
  } catch (error) {
    console.error("[webhook mp] MERCADO_PAGO_WEBHOOK_SECRET ausente");
    return jsonResponse(500, { success: false, message: "Segredo não configurado" });
  }

  if (!verifyMercadoPagoSignature({ signatureHeader, requestId, dataId, secret })) {
    console.error("[webhook mp] Assinatura inválida");
    return jsonResponse(401, { success: false, message: "Assinatura inválida" });
  }

  const event = (() => {
    try {
      return JSON.parse(rawBody || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  // Eventos de checkout chegam com type=payment e data.id = id do pagamento.
  const eventType = typeof event.type === "string" ? event.type : "payment";

  // A assinatura já foi validada; para obter o external_reference confiável,
  // busca-se o pagamento na API (o payload do webhook pode estar truncado).
  let externalReference = "";
  let paid = false;
  let transactionId = dataId;

  try {
    const { getMercadoPagoAccessToken, MERCADO_PAGO_API } = await import("./mercadopago.server");
    const token = getMercadoPagoAccessToken();
    const res = await fetch(`${MERCADO_PAGO_API}/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const payment = (await res.json()) as {
        external_reference?: string | null;
        status?: string;
        status_detail?: string;
        id?: number | string;
      };
      externalReference = payment.external_reference ?? "";
      paid = payment.status === "approved";
      transactionId = String(payment.id ?? dataId);
    } else {
      console.error(`[webhook mp] Falha ao buscar pagamento ${dataId}: HTTP ${res.status}`);
    }
  } catch (error) {
    console.error("[webhook mp] Erro ao buscar pagamento:", error);
  }

  if (!externalReference) {
    return jsonResponse(400, { success: false, message: "external_reference não localizado" });
  }

  const result = await processPaymentWebhook({
    provider: "mercado_pago",
    eventId: `mp:${eventType}:${dataId}`,
    transactionId,
    externalReference,
    paid,
    rawPayload: (event as unknown as Json) ?? {},
  });

  return jsonResponse(result.status, result.body);
}

// --- InfinityPay --------------------------------------------------------------

async function handleInfinityPayWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { success: false, message: "Corpo inválido" });
  }

  const orderNsu = typeof payload.order_nsu === "string" ? payload.order_nsu : "";
  const transactionNsu = typeof payload.transaction_nsu === "string" ? payload.transaction_nsu : "";
  const slug = typeof payload.invoice_slug === "string" ? payload.invoice_slug : "";

  // InfinityPay não assina o webhook; a validação é por order_nsu (deve
  // corresponder a um checkout real nosso) + idempotência por transaction_nsu.
  if (!orderNsu) {
    return jsonResponse(400, { success: false, message: "order_nsu ausente" });
  }

  const result = await processPaymentWebhook({
    provider: "infinitypay",
    eventId: `ip:${slug || transactionNsu || orderNsu}`,
    transactionId: transactionNsu || orderNsu,
    externalReference: orderNsu,
    paid: true, // o webhook só é enviado quando o pagamento é aprovado
    rawPayload: (payload as unknown as Json) ?? {},
  });

  // 400 faz o InfinityPay reenviar; 200 confirma o recebimento.
  return jsonResponse(result.status, result.body);
}
