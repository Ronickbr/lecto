import { ERROR_CATALOG } from "./catalog";
import { toUserErrorPayload } from "./app-error";
import type { ErrorCode, UserError } from "./types";

/**
 * Converte qualquer erro (AppError, ZodError, Supabase, rede, string…) em um
 * `UserError` amigável, no padrão título + descrição + como resolver.
 *
 * Mensagens técnicas (env, SQL, JSON de validação, stack traces) NUNCA chegam
 * ao usuário: caem no fallback amigável do catálogo. Mensagens já redigidas em
 * pt-BR passam adiante com um título derivado da categoria.
 */

const MAX_MSG = 200;

function extractMessage(err: unknown): string | null {
  if (err === null || err === undefined) return null;
  if (typeof err === "string") return err.length ? err : null;
  if (err instanceof Error) return err.message || null;
  if (typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.length) return message;
  }
  return null;
}

/** Mensagem com cara de erro técnico → não deve ser exposta ao usuário. */
function looksTechnical(msg: string): boolean {
  return (
    msg.length > MAX_MSG ||
    /[{}[\]]/.test(msg) ||
    /(postgrest|supabase|fetch failed|failed to fetch|missing |undefined is not|cannot read|sqlstate|code \d{5}|at .*:\d+:\d+)/i.test(
      msg,
    )
  );
}

/** Categoriza a mensagem por heurística para gerar título e "como resolver". */
function matchHeuristic(msg: string): ErrorCode | null {
  if (
    /unauthorized|invalid token|expired|jwt|n.o autenticad|sess(o|ã)o (n.o v.lida|expirou)|not authenticated/i.test(
      msg,
    )
  )
    return "auth";
  if (/sem permiss(o|ã)o|n.o autorizad|apenas o administrador|forbidden/i.test(msg))
    return "permission";
  if (/n.o (foi )?encontrad|not found|inexistente/i.test(msg)) return "not_found";
  if (/limite.*plano|plano.*limite|permite no m.ximo|excede.*limite/i.test(msg))
    return "plan_limit";
  if (/muitas tentativas|aguarde.*(poucos|alguns) minutos|tentativas em sequ|too many/i.test(msg))
    return "rate_limit";
  if (/conex(o|ã)o|sem internet|falha de rede/i.test(msg)) return "network";
  if (/pagamento|checkout|cart(o|ã)o/i.test(msg)) return "payment";
  if (
    /inv.lid|obrigat.r|deve (ser|ter|informar|conter)|preencha|n.o pode (ser|ficar) vazio/i.test(
      msg,
    )
  )
    return "validation";
  if (/j. existe|duplicad|em uso|j. cadastrad|conflict/i.test(msg)) return "conflict";
  return null;
}

export function toUserError(err: unknown, opts?: { fallback?: string }): UserError {
  const structured = toUserErrorPayload(err);
  if (structured) return structured;

  const raw = extractMessage(err) ?? opts?.fallback ?? null;
  if (raw) {
    const code = matchHeuristic(raw) ?? "server";
    if (!looksTechnical(raw)) {
      return {
        code,
        title: ERROR_CATALOG[code].title,
        message: raw,
        suggestion: ERROR_CATALOG[code].suggestion,
      };
    }
    return {
      code,
      title: ERROR_CATALOG[code].title,
      message: ERROR_CATALOG[code].message,
      suggestion: ERROR_CATALOG[code].suggestion,
    };
  }

  return { ...ERROR_CATALOG.unknown, code: "unknown" };
}
