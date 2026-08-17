import type { ErrorCatalogEntry, ErrorCode } from "./types";

/**
 * Catálogo central de mensagens amigáveis por categoria de erro.
 * Toda mensagem segue o padrão: título curto + descrição objetiva + como resolver.
 */
export const ERROR_CATALOG: Record<ErrorCode, ErrorCatalogEntry> = {
  auth: {
    title: "Sessão não válida",
    message: "Não foi possível validar o seu acesso.",
    suggestion: "Entre novamente com sua conta e tente de novo.",
  },
  permission: {
    title: "Sem permissão",
    message: "Sua conta não tem acesso a essa ação.",
    suggestion:
      "Verifique se você está com a conta correta ou peça acesso a um responsável da instituição.",
  },
  not_found: {
    title: "Não encontramos o item",
    message: "O que você procura não existe ou já foi removido.",
    suggestion: "Verifique o código informado e atualize a página.",
  },
  validation: {
    title: "Confira os dados informados",
    message: "Alguns campos não estão preenchidos corretamente.",
    suggestion: "Revise as informações e tente salvar novamente.",
  },
  conflict: {
    title: "Dados já em uso",
    message: "Essas informações já existem no sistema.",
    suggestion: "Use dados diferentes ou verifique os registros existentes.",
  },
  plan_limit: {
    title: "Limite do plano atingido",
    message: "Essa ação excede os limites do plano contratado.",
    suggestion: "Remova itens existentes ou contrate um plano superior.",
  },
  rate_limit: {
    title: "Muitas tentativas",
    message: "Você fez várias tentativas em sequência.",
    suggestion: "Aguarde alguns minutos e tente novamente.",
  },
  network: {
    title: "Problema de conexão",
    message: "Não foi possível conectar ao servidor.",
    suggestion: "Verifique sua internet e tente novamente.",
  },
  payment: {
    title: "Pagamento não concluído",
    message: "Não foi possível concluir a operação de pagamento.",
    suggestion: "Confira os dados informados e tente novamente, ou fale com o suporte.",
  },
  upstream: {
    title: "Serviço temporariamente indisponível",
    message: "Um serviço externo não respondeu como esperado.",
    suggestion: "Tente novamente em alguns instantes.",
  },
  server: {
    title: "Algo deu errado",
    message: "Não foi possível concluir a ação.",
    suggestion: "Tente novamente. Se o problema persistir, entre em contato com o suporte.",
  },
  unknown: {
    title: "Algo inesperado aconteceu",
    message: "Encontramos um erro inesperado.",
    suggestion: "Tente novamente. Se o problema persistir, entre em contato com o suporte.",
  },
};
