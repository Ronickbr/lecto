export type ErrorCode =
  | "auth"
  | "permission"
  | "not_found"
  | "validation"
  | "conflict"
  | "plan_limit"
  | "rate_limit"
  | "network"
  | "payment"
  | "upstream"
  | "server"
  | "unknown";

export interface ErrorCatalogEntry {
  title: string;
  message: string;
  suggestion: string;
}

/** Estrutura padrão exibida ao usuário: título curto + descrição + como resolver. */
export interface UserError {
  code: ErrorCode;
  title: string;
  message: string;
  suggestion?: string;
}
