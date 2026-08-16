import { createHmac, timingSafeEqual } from "node:crypto";

export const MERCADO_PAGO_API = "https://api.mercadopago.com";

export function getMercadoPagoAccessToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Missing MERCADO_PAGO_ACCESS_TOKEN");
  return token;
}

export function getMercadoPagoWebhookSecret(): string {
  // Se não houver segredo dedicado, o access token também pode validar a
  // assinatura do webhook (é a chave usada pelo MP para assinar o payload).
  return process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? getMercadoPagoAccessToken();
}

export interface CheckoutPreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: "BRL";
  id?: string;
}

export interface CreateCheckoutPreferenceOptions {
  items: CheckoutPreferenceItem[];
  externalReference: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  notificationUrl: string;
  payerEmail?: string;
  autoReturn?: "approved";
}

export interface CreateCheckoutPreferenceResult {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  external_reference: string;
  status?: string;
}

export async function createCheckoutPreference(
  options: CreateCheckoutPreferenceOptions,
): Promise<CreateCheckoutPreferenceResult> {
  const token = getMercadoPagoAccessToken();

  const res = await fetch(`${MERCADO_PAGO_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: options.items,
      external_reference: options.externalReference,
      notification_url: options.notificationUrl,
      back_urls: options.backUrls,
      auto_return: options.autoReturn ?? "approved",
      ...(options.payerEmail ? { payer: { email: options.payerEmail } } : {}),
    }),
  });

  const body = (await res.json()) as Partial<CreateCheckoutPreferenceResult> & {
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      `Mercado Pago erro ${res.status}: ${body.message ?? body.error ?? "falha ao criar preferência"}`,
    );
  }

  return body as CreateCheckoutPreferenceResult;
}

/**
 * Verifica a assinatura `x-signature` do webhook do Mercado Pago.
 *
 * O MP envia o header no formato `ts=<timestamp>,v1=<hmac>` e assina a string
 * canônica: `id:[data.id];request-id:[x-request-id];ts:[ts];` com HMAC-SHA256
 * usando o segredo do app (access token) como chave.
 */
export function verifyMercadoPagoSignature(params: {
  signatureHeader: string;
  requestId: string | null;
  dataId: string;
  secret: string;
  maxAgeSeconds?: number;
}): boolean {
  const { signatureHeader, requestId, dataId, secret, maxAgeSeconds = 600 } = params;
  if (!signatureHeader) return false;

  const parts = new Map<string, string>();
  for (const pair of signatureHeader.split(",")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) parts.set(key, rest.join("="));
  }
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return false;

  if (maxAgeSeconds > 0) {
    const timestamp = Number(ts);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(Date.now() / 1000 - timestamp) > maxAgeSeconds) return false;
  }

  const canonical = `id:${dataId};request-id:${requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");

  if (v1.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

export interface MercadoPagoConnectionInfo {
  id: number;
  nickname: string | null;
  email: string | null;
  site_id: string | null;
}

export async function testMercadoPagoConnection(): Promise<{
  ok: boolean;
  status: number;
  message: string;
}> {
  const token = getMercadoPagoAccessToken();
  try {
    const res = await fetch(`${MERCADO_PAGO_API}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as Partial<MercadoPagoConnectionInfo> & {
      message?: string;
      error?: string;
    };
    if (res.ok) {
      const identity = body.nickname ?? body.email ?? `id ${body.id}`;
      return { ok: true, status: res.status, message: `Conta conectada: ${identity}` };
    }
    return {
      ok: false,
      status: res.status,
      message: body.message ?? body.error ?? `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
