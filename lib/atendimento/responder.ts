// Motor do atendimento: recebe a pergunta em texto livre e escolhe a resposta.
//
// É de propósito simples e determinístico -- sem IA, sem chamada externa, sem
// chave de API. Assim ele responde na hora, funciona offline e, principalmente,
// nunca inventa preço, prazo ou estoque: só diz o que está em conhecimento.ts.
// Quando não reconhece, admite e manda para o WhatsApp.

import { ASSUNTOS, respostaDeEscape, SUGESTOES_INICIAIS, type Acao } from "./conhecimento";

export type Resposta = {
  id: string;
  texto: string;
  acao?: Acao;
  sugestoes: string[];
  // false quando caiu no escape, para quem chama saber que não houve match.
  entendeu: boolean;
};

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9\s]/g, " ") // pontuação vira espaço
    .replace(/\s+/g, " ")
    .trim();
}

// Gatilho de uma palavra só precisa casar a palavra inteira, senão "oi" casaria
// dentro de "foi" e "coisa". Gatilho com espaço casa como trecho.
function casa(textoNormalizado: string, gatilho: string): boolean {
  const g = normalizar(gatilho);
  if (!g) return false;
  if (g.includes(" ")) return textoNormalizado.includes(g);
  return new RegExp(`(^| )${g}( |$)`).test(textoNormalizado);
}

// Gatilho mais longo vale mais: "nota fiscal" deve ganhar de "nota" solta.
function pontuar(textoNormalizado: string, gatilhos: string[]): number {
  let pontos = 0;
  for (const gatilho of gatilhos) {
    if (casa(textoNormalizado, gatilho)) pontos += normalizar(gatilho).length;
  }
  return pontos;
}

export function responder(pergunta: string): Resposta {
  const texto = normalizar(pergunta ?? "");

  if (!texto) {
    return {
      id: "vazio",
      texto: "Pode escrever sua dúvida que eu te ajudo 😊",
      sugestoes: SUGESTOES_INICIAIS,
      entendeu: false,
    };
  }

  let melhor: { assunto: (typeof ASSUNTOS)[number]; pontos: number } | null = null;
  for (const assunto of ASSUNTOS) {
    const pontos = pontuar(texto, assunto.gatilhos);
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { assunto, pontos };
  }

  // Saudação é fraca: se a mensagem tem mais coisa junto ("oi, como compro?"),
  // o outro assunto ganha. O desempate já acontece pela pontuação, mas uma
  // saudação sozinha não deve engolir uma pergunta longa.
  if (melhor?.assunto.id === "saudacao" && texto.split(" ").length > 4) {
    const semSaudacao = ASSUNTOS.filter((a) => a.id !== "saudacao")
      .map((assunto) => ({ assunto, pontos: pontuar(texto, assunto.gatilhos) }))
      .filter((x) => x.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos)[0];
    if (semSaudacao) melhor = semSaudacao;
  }

  if (!melhor) {
    const escape = respostaDeEscape(pergunta);
    return {
      id: "escape",
      texto: escape.resposta,
      acao: escape.acao,
      sugestoes: SUGESTOES_INICIAIS,
      entendeu: false,
    };
  }

  return {
    id: melhor.assunto.id,
    texto: melhor.assunto.resposta,
    acao: melhor.assunto.acao,
    sugestoes: melhor.assunto.seguir ?? SUGESTOES_INICIAIS,
    entendeu: true,
  };
}
