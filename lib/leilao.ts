// Regras do leilão ao vivo. Tudo aqui é função pura: decide, não grava.
// Quem grava é a rota da API, que confere as regras daqui antes de aceitar.

export type EstadoLote = "aguardando" | "aberto" | "encerrado" | "cancelado";

export type Lote = {
  id: string;
  ordem: number;
  titulo: string;
  descricao?: string;
  imagem?: string;
  lanceInicialCentavos: number;
  incrementoCentavos: number;
  estado: EstadoLote;
  abertoEm?: number;
  fechaEm?: number;
  vencedorId?: string;
  vencedorNome?: string;
  vencedorCentavos?: number;
};

export type Lance = {
  id: string;
  loteId: string;
  participanteId: string;
  nome: string;
  centavos: number;
  em: number;
};

export type Participante = {
  id: string;
  nome: string;
  whatsapp: string;
  bloqueado?: boolean;
};

// Lance nos últimos JANELA_MS segundos empurra o fim para agora + JANELA_MS.
// É o que impede o lance de última hora ganhar sem disputa.
export const JANELA_MS = 15000;
// Duração padrão de um lote quando o leiloeiro não escolhe outra.
export const DURACAO_PADRAO_MS = 60000;
// Teto de segurança: um lance não pode passar 50 incrementos de uma vez
// (evita o dedo gordo que digita 15000 em vez de 150).
export const MAX_SALTOS = 50;

export type ErroLance =
  | "lote-fechado"
  | "participante-bloqueado"
  | "valor-baixo"
  | "valor-alto-demais"
  | "ja-esta-ganhando"
  | "sem-nome";

export function maiorLance(lances: Lance[], loteId: string): Lance | null {
  const doLote = lances.filter((l) => l.loteId === loteId);
  if (doLote.length === 0) return null;
  // Maior valor; empate no valor, quem chegou primeiro continua ganhando.
  return doLote.reduce((melhor, atual) => {
    if (atual.centavos > melhor.centavos) return atual;
    if (atual.centavos === melhor.centavos && atual.em < melhor.em) return atual;
    return melhor;
  });
}

export function proximoMinimo(lote: Lote, maior: Lance | null): number {
  return maior ? maior.centavos + lote.incrementoCentavos : lote.lanceInicialCentavos;
}

export function validarLance({
  lote,
  maior,
  participante,
  centavos,
  agora,
}: {
  lote: Lote;
  maior: Lance | null;
  participante: Participante;
  centavos: number;
  agora: number;
}): { ok: true; minimo: number } | { ok: false; erro: ErroLance; minimo: number } {
  const minimo = proximoMinimo(lote, maior);
  const falha = (erro: ErroLance) => ({ ok: false as const, erro, minimo });

  if (!participante.nome?.trim()) return falha("sem-nome");
  if (participante.bloqueado) return falha("participante-bloqueado");
  if (lote.estado !== "aberto") return falha("lote-fechado");
  if (lote.fechaEm !== undefined && agora >= lote.fechaEm) return falha("lote-fechado");
  if (maior && maior.participanteId === participante.id) return falha("ja-esta-ganhando");
  if (!Number.isFinite(centavos) || centavos < minimo) return falha("valor-baixo");
  if (centavos > minimo + lote.incrementoCentavos * MAX_SALTOS) return falha("valor-alto-demais");

  return { ok: true, minimo };
}

// Novo horário de fechamento depois de um lance aceito.
export function prorrogar(lote: Lote, agora: number): number {
  const fim = lote.fechaEm ?? agora;
  return fim - agora <= JANELA_MS ? agora + JANELA_MS : fim;
}

export function abrirLote(lote: Lote, agora: number, duracaoMs = DURACAO_PADRAO_MS): Lote {
  return { ...lote, estado: "aberto", abertoEm: agora, fechaEm: agora + duracaoMs };
}

export function encerrarLote(lote: Lote, maior: Lance | null): Lote {
  if (!maior) return { ...lote, estado: "encerrado", fechaEm: lote.fechaEm };
  return {
    ...lote,
    estado: "encerrado",
    vencedorId: maior.participanteId,
    vencedorNome: maior.nome,
    vencedorCentavos: maior.centavos,
  };
}

// Quanto cada pessoa levou no leilão inteiro: é isso que vira a cobrança.
export function caixas(lotes: Lote[]) {
  const porPessoa = new Map<string, { nome: string; centavos: number; lotes: string[] }>();
  for (const lote of lotes) {
    if (lote.estado !== "encerrado" || !lote.vencedorId || !lote.vencedorCentavos) continue;
    const atual = porPessoa.get(lote.vencedorId) ?? { nome: lote.vencedorNome ?? "", centavos: 0, lotes: [] };
    atual.centavos += lote.vencedorCentavos;
    atual.lotes.push(lote.id);
    porPessoa.set(lote.vencedorId, atual);
  }
  return [...porPessoa.entries()].map(([participanteId, dados]) => ({ participanteId, ...dados }));
}

export function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
