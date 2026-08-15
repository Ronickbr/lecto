import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Provedor de IA compatível com a API OpenAI. Configurável por variáveis de
 * ambiente — sem dependência de fornecedor específico:
 *
 * - AI_BASE_URL  (ex.: "https://api.openai.com/v1" ou qualquer gateway OpenAI-compatível)
 * - AI_API_KEY   (chave de API do provedor)
 * - AI_MODEL     (modelo padrão; cada chamada pode sobrescrever)
 */
export function getAiBaseUrl(): string {
  const url = process.env.AI_BASE_URL;
  if (!url) throw new Error("Missing AI_BASE_URL");
  return url.replace(/\/+$/, "");
}

export function getAiApiKey(): string | null {
  return process.env.AI_API_KEY ?? null;
}

export function getAiModel(): string {
  return process.env.AI_MODEL ?? "google/gemini-3.6-flash";
}

export function createAiProvider(apiKey?: string) {
  const key = apiKey ?? getAiApiKey();
  if (!key) throw new Error("Missing AI_API_KEY");
  return createOpenAICompatible({
    name: "lecto-ai",
    baseURL: getAiBaseUrl(),
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  });
}
