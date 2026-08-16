import { Resend } from "resend";

let _resend: Resend | undefined;

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

export function getResendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? "Lecto <no-reply@lecto.app>";
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: getResendFromEmail(),
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(options.text ? { text: options.text } : {}),
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });

  if (error) throw new Error(`Resend erro: ${error.message}`);
  return { id: data?.id ?? "" };
}

export async function testResendConnection(): Promise<{
  ok: boolean;
  status: number;
  message: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, status: 0, message: "Missing RESEND_API_KEY" };

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ name?: string; status?: string }> };
      const domains = body.data ?? [];
      const verified = domains.find((d) => d.status === "verified");
      return {
        ok: true,
        status: res.status,
        message: verified
          ? `Domínio verificado: ${verified.name}`
          : domains.length
            ? `Conectado (${domains.length} domínio(s), nenhum verificado ainda)`
            : "Conectado, mas sem domínio configurado",
      };
    }
    const errBody = (await res.json()) as { message?: string };
    return { ok: false, status: res.status, message: errBody.message ?? `HTTP ${res.status}` };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// --- Templates transacionais -------------------------------------------------

export function verificationEmailTemplate(opts: {
  code: string;
  expiresInMinutes: number;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111">Confirme seu e-mail</h2>
      <p>Use o código abaixo para confirmar seu endereço de e-mail:</p>
      <div style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f4f4f5;border-radius:12px;padding:16px;text-align:center">
        ${opts.code}
      </div>
      <p style="color:#666;font-size:13px">O código expira em ${opts.expiresInMinutes} minutos.</p>
      <p style="color:#999;font-size:12px">Se você não pediu este código, ignore este e-mail.</p>
    </div>`;
}

export function passwordResetEmailTemplate(opts: { resetUrl: string }): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111">Redefinição de senha</h2>
      <p>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para continuar:</p>
      <a href="${opts.resetUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:bold">
        Redefinir senha
      </a>
      <p style="color:#666;font-size:13px;margin-top:16px">Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p style="color:#666;font-size:12px;word-break:break-all">${opts.resetUrl}</p>
      <p style="color:#999;font-size:12px">Se você não pediu a redefinição, ignore este e-mail.</p>
    </div>`;
}

export function notificationEmailTemplate(opts: {
  title: string;
  message: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111">${opts.title}</h2>
      <p style="color:#333">${opts.message}</p>
      ${
        opts.ctaUrl && opts.ctaLabel
          ? `<a href="${opts.ctaUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:bold">${opts.ctaLabel}</a>`
          : ""
      }
      <p style="color:#999;font-size:12px;margin-top:16px">Lecto — Plataforma de Compreensão Leitora</p>
    </div>`;
}
