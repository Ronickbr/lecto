export const INFINITYPAY_API = "https://api.checkout.infinitepay.io";

export function getInfinityPayHandle(): string {
  const handle = process.env.INFINITYPAY_HANDLE;
  if (!handle) throw new Error("Missing INFINITYPAY_HANDLE");
  return handle.replace(/^\$/, "").trim();
}

export interface InfinityPayItem {
  quantity: number;
  price: number;
  description: string;
}

export interface CreateInfinityPayLinkOptions {
  handle: string;
  items: InfinityPayItem[];
  orderNsu?: string;
  redirectUrl?: string;
  webhookUrl?: string;
  customer?: {
    name?: string;
    email?: string;
    phone_number?: string;
  };
}

export interface CreateInfinityPayLinkResult {
  slug: string;
  checkout_url?: string;
  link?: string;
  [key: string]: unknown;
}

export async function createInfinityPayLink(
  options: CreateInfinityPayLinkOptions,
): Promise<CreateInfinityPayLinkResult> {
  const res = await fetch(`${INFINITYPAY_API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: options.handle,
      items: options.items,
      ...(options.orderNsu ? { order_nsu: options.orderNsu } : {}),
      ...(options.redirectUrl ? { redirect_url: options.redirectUrl } : {}),
      ...(options.webhookUrl ? { webhook_url: options.webhookUrl } : {}),
      ...(options.customer ? { customer: options.customer } : {}),
    }),
  });

  const body = (await res.json()) as CreateInfinityPayLinkResult & {
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      `InfinityPay erro ${res.status}: ${body.message ?? body.error ?? "falha ao criar link"}`,
    );
  }

  return body;
}

export interface CheckInfinityPayPaymentOptions {
  handle: string;
  orderNsu?: string;
  transactionNsu?: string;
  slug?: string;
}

export interface CheckInfinityPayPaymentResult {
  success: boolean;
  paid: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
}

export async function checkInfinityPayPayment(
  options: CheckInfinityPayPaymentOptions,
): Promise<CheckInfinityPayPaymentResult> {
  const res = await fetch(`${INFINITYPAY_API}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: options.handle,
      ...(options.orderNsu ? { order_nsu: options.orderNsu } : {}),
      ...(options.transactionNsu ? { transaction_nsu: options.transactionNsu } : {}),
      ...(options.slug ? { slug: options.slug } : {}),
    }),
  });

  const body = (await res.json()) as CheckInfinityPayPaymentResult & {
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      `InfinityPay erro ${res.status}: ${body.message ?? body.error ?? "falha ao consultar pagamento"}`,
    );
  }

  return body;
}

/**
 * Testa a conexão com a InfinityPay. Como a API não exige chave, o teste
 * confirma que a handle (InfiniteTag) é válida e que a API responde.
 */
export async function testInfinityPayConnection(): Promise<{
  ok: boolean;
  status: number;
  message: string;
}> {
  const handle = getInfinityPayHandle();
  try {
    // A API não expõe endpoint de usuário; validar a handle tentando criar um
    // link mínimo (1 centavo) e descartando a URL gerada. Não cobra nada até o
    // pagamento e não dispara webhook (pagamento nunca ocorre).
    const result = await createInfinityPayLink({
      handle,
      items: [{ quantity: 1, price: 1, description: "Teste de conexão Lecto" }],
    });
    const url = result.checkout_url ?? result.link;
    return {
      ok: true,
      status: 200,
      message: url ? `Handle válida: ${handle} (link de teste gerado)` : `Handle válida: ${handle}`,
    };
  } catch (error) {
    return {
      ok: false,
      status:
        error instanceof Error && error.message.includes("InfinityPay erro ")
          ? Number(error.message.match(/erro (\d+)/)?.[1] ?? 0)
          : 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
