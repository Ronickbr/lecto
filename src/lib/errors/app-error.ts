import { ERROR_CATALOG } from "./catalog";
import type { ErrorCode, UserError } from "./types";

/**
 * Erro estruturado da aplicação. Carrega a categoria (`code`) para o cliente
 * via serialização do TanStack Start (propriedades próprias viajam no erro) —
 * título e "como resolver" são preenchidos pelo catálogo quando não informados.
 */
export interface AppErrorInit {
  code: ErrorCode;
  message: string;
  title?: string;
  suggestion?: string;
  /** Detalhes técnicos para debug. São registrados no log e NÃO vão ao usuário. */
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly title: string;
  readonly suggestion?: string;

  constructor(init: AppErrorInit) {
    super(init.message);
    this.name = "AppError";
    this.code = init.code;
    this.title = init.title ?? ERROR_CATALOG[init.code].title;
    this.suggestion = init.suggestion ?? ERROR_CATALOG[init.code].suggestion;
    if (init.cause !== undefined) this.cause = init.cause;
  }
}

/**
 * Lança um AppError. Se houver detalhes técnicos, registra-os no console aqui
 * (server-side) para debug, sem jamais serializá-los para o cliente.
 */
export function fail(init: AppErrorInit): never {
  if (init.details !== undefined) {
    console.error(`[lecto:${init.code}]`, init.details);
  }
  throw new AppError(init);
}

/**
 * Detecta o envelope estruturado. Funciona tanto para instâncias de `AppError`
 * quanto para o objeto reidratado no cliente após a serialização (que é um
 * `Error` comum com as propriedades `code`/`title`/`suggestion` anexadas).
 */
export function isAppError(err: unknown): err is AppError {
  if (err === null || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  return typeof e.code === "string" && typeof e.message === "string";
}

export function toUserErrorPayload(err: unknown): UserError | null {
  if (!isAppError(err)) return null;
  const e = err as AppError;
  return {
    code: e.code,
    title: e.title,
    message: e.message,
    suggestion: e.suggestion,
  };
}
